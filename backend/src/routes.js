import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { bucket, messages, posts, profiles } from './db.js';

const router = Router();
const MAX_BYTES = 25 * 1024 * 1024; // límite de videos y archivos
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 10 } });

const isMedia = (f) => /^(image|video)\//.test(f.mimetype);
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res, msg = 'No se encontró el elemento.') => res.status(404).json({ error: msg });
const toId = (s) => (ObjectId.isValid(s) ? new ObjectId(s) : null);
const iso = (d) => new Date(d).toISOString();

/* ---------- Formatos de respuesta ---------- */
const profileShape = (d) => ({
  uid: d._id,
  email: d.email,
  username: d.username,
  avatar_media_id: d.avatar_media_id ? d.avatar_media_id.toString() : null,
  theme: d.theme,
});
const mediaShape = (id, ownerUid, mime, date) => ({
  id: id.toString(),
  owner_uid: ownerUid,
  mime,
  created_at: iso(date),
});
const commentShape = (c) => ({ id: c.id.toString(), uid: c.uid, text: c.text, created_at: iso(c.created_at) });
export const toMsg = (d) => ({
  id: d._id.toString(),
  sender_uid: d.sender_uid,
  text: d.text,
  created_at: iso(d.created_at),
});

/** Guarda un archivo en GridFS y devuelve su id. */
function saveFile(file, ownerUid, kind) {
  return new Promise((resolve, reject) => {
    const up = bucket.openUploadStream(file.originalname || 'archivo', {
      metadata: { owner_uid: ownerUid, kind, mime: file.mimetype },
    });
    up.once('error', reject);
    up.once('finish', () => resolve(up.id));
    up.end(file.buffer);
  });
}

/* ---------- Perfil ---------- */

router.get('/me', async (req, res) => {
  const { uid, email } = req.user;
  const doc = await profiles.findOneAndUpdate(
    { _id: uid },
    {
      $set: { email },
      $setOnInsert: { username: email.split('@')[0], avatar_media_id: null, theme: 'light', created_at: new Date() },
    },
    { upsert: true, returnDocument: 'after' }
  );
  res.json(profileShape(doc));
});

router.patch('/me', async (req, res) => {
  const { username, theme } = req.body || {};
  const set = {};
  if (username !== undefined) {
    const name = String(username).trim();
    if (name.length < 2 || name.length > 30) {
      return bad(res, 'El nombre de usuario debe tener entre 2 y 30 caracteres.');
    }
    set.username = name;
  }
  if (theme !== undefined) {
    if (!['light', 'dark'].includes(theme)) return bad(res, 'Tema no válido.');
    set.theme = theme;
  }
  const doc = Object.keys(set).length
    ? await profiles.findOneAndUpdate({ _id: req.user.uid }, { $set: set }, { returnDocument: 'after' })
    : await profiles.findOne({ _id: req.user.uid });
  if (!doc) return notFound(res);
  res.json(profileShape(doc));
});

router.post('/me/avatar', upload.single('file'), async (req, res) => {
  const f = req.file;
  if (!f || !f.mimetype.startsWith('image/')) return bad(res, 'Elige una imagen.');
  const { uid } = req.user;
  const old = await profiles.findOne({ _id: uid }, { projection: { avatar_media_id: 1 } });
  if (!old) return notFound(res);
  const id = await saveFile(f, uid, 'avatar');
  const doc = await profiles.findOneAndUpdate({ _id: uid }, { $set: { avatar_media_id: id } }, { returnDocument: 'after' });
  if (old.avatar_media_id) bucket.delete(old.avatar_media_id).catch(() => {});
  res.json(profileShape(doc));
});

router.get('/profiles', async (_req, res) => {
  const docs = await profiles.find().toArray();
  res.json(
    docs.map((d) => ({
      uid: d._id,
      username: d.username,
      avatar_media_id: d.avatar_media_id ? d.avatar_media_id.toString() : null,
    }))
  );
});

/* ---------- Álbum (media) ---------- */

router.get('/media', async (_req, res) => {
  const docs = await bucket.find({ 'metadata.kind': 'album' }).sort({ uploadDate: -1 }).toArray();
  res.json(docs.map((d) => mediaShape(d._id, d.metadata.owner_uid, d.metadata.mime, d.uploadDate)));
});

router.post('/media', upload.array('files', 10), async (req, res) => {
  const files = req.files || [];
  if (!files.length || !files.every(isMedia)) return bad(res, 'Solo se permiten fotos y videos.');
  const out = [];
  for (const f of files) {
    const id = await saveFile(f, req.user.uid, 'album');
    out.push(mediaShape(id, req.user.uid, f.mimetype, new Date()));
  }
  res.status(201).json(out);
});

router.get('/media/:id/file', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return notFound(res, 'Archivo no encontrado.');
  const [file] = await bucket.find({ _id: id }).limit(1).toArray();
  if (!file) return notFound(res, 'Archivo no encontrado.');
  res.set({
    'Content-Type': file.metadata?.mime || 'application/octet-stream',
    'Content-Length': String(file.length),
    'Cache-Control': 'private, max-age=86400',
  });
  bucket.openDownloadStream(id).on('error', () => res.destroy()).pipe(res);
});

router.delete('/media/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [file] = id ? await bucket.find({ _id: id }).limit(1).toArray() : [];
  if (!file || file.metadata?.kind !== 'album' || file.metadata.owner_uid !== req.user.uid) {
    return notFound(res, 'Solo puedes borrar lo que subiste tú.');
  }
  await bucket.delete(id);
  await posts.deleteMany({ media_id: id }); // también se quitan las publicaciones que la usaban
  res.json({ ok: true });
});

/* ---------- Publicaciones (likes y comentarios viven dentro de cada publicación) ---------- */

router.get('/posts', async (req, res) => {
  const docs = await posts.find().sort({ _id: -1 }).limit(50).toArray();
  res.json(
    docs.map((p) => ({
      id: p._id.toString(),
      author_uid: p.author_uid,
      media_id: p.media_id.toString(),
      mime: p.mime,
      caption: p.caption,
      created_at: iso(p.created_at),
      likes: p.likes.length,
      liked: p.likes.includes(req.user.uid),
      comments: p.comments.map(commentShape),
    }))
  );
});

router.post('/posts', async (req, res) => {
  const mediaId = toId(req.body?.mediaId);
  const caption = String(req.body?.caption || '').trim().slice(0, 2200);
  const [file] = mediaId ? await bucket.find({ _id: mediaId }).limit(1).toArray() : [];
  if (!file || file.metadata?.kind !== 'album') return bad(res, 'Esa foto no está en el álbum.');
  const r = await posts.insertOne({
    author_uid: req.user.uid,
    media_id: mediaId,
    mime: file.metadata.mime,
    caption,
    created_at: new Date(),
    likes: [],
    comments: [],
  });
  res.status(201).json({ id: r.insertedId.toString() });
});

router.delete('/posts/:id', async (req, res) => {
  const id = toId(req.params.id);
  const r = id ? await posts.deleteOne({ _id: id, author_uid: req.user.uid }) : { deletedCount: 0 };
  if (!r.deletedCount) return notFound(res, 'Solo puedes borrar tus publicaciones.');
  res.json({ ok: true });
});

router.post('/posts/:id/like', async (req, res) => {
  const id = toId(req.params.id);
  const post = id ? await posts.findOne({ _id: id }, { projection: { likes: 1 } }) : null;
  if (!post) return notFound(res);
  const has = post.likes.includes(req.user.uid);
  await posts.updateOne({ _id: id }, has ? { $pull: { likes: req.user.uid } } : { $addToSet: { likes: req.user.uid } });
  res.json({ liked: !has });
});

router.post('/posts/:id/comments', async (req, res) => {
  const id = toId(req.params.id);
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (!text) return bad(res, 'Escribe un comentario.');
  const comment = { id: new ObjectId(), uid: req.user.uid, text, created_at: new Date() };
  const r = id ? await posts.updateOne({ _id: id }, { $push: { comments: comment } }) : { matchedCount: 0 };
  if (!r.matchedCount) return notFound(res);
  res.status(201).json(commentShape(comment));
});

/* ---------- Chat (historial; los mensajes nuevos van por Socket.IO) ---------- */

router.get('/messages', async (_req, res) => {
  const docs = await messages.find().sort({ _id: -1 }).limit(200).toArray();
  res.json(docs.reverse().map(toMsg));
});

export default router;
