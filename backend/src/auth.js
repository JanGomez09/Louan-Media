import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/* Las dos únicas cuentas viven en variables de entorno (correo + hash bcrypt). */
const users = [1, 2]
  .map((n) => ({
    uid: `user${n}`, // id estable que se usa en la base de datos
    email: (process.env[`USER${n}_EMAIL`] || '').trim().toLowerCase(),
    hash: (process.env[`USER${n}_HASH`] || '').trim(),
  }))
  .filter((u) => u.email && u.hash);

const SECRET = process.env.JWT_SECRET || '';
if (users.length !== 2) {
  throw new Error('Faltan USER1_EMAIL/USER1_HASH o USER2_EMAIL/USER2_HASH en el .env');
}
if (SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres (usa: npm run secret)');
}

const EXPIRES = process.env.JWT_EXPIRES_IN || '30d';
const DUMMY_HASH = bcrypt.hashSync('relleno', 10); // para que el tiempo de respuesta sea parecido

/* ---------- Límite de intentos fallidos: 5 cada 15 minutos por IP + correo ---------- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fails) if (now - v.first > WINDOW_MS) fails.delete(k);
}, WINDOW_MS).unref();

export async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${email}`;
  const now = Date.now();

  let f = fails.get(key);
  if (f && now - f.first > WINDOW_MS) f = undefined;
  if (f && f.count >= MAX_FAILS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.' });
  }

  const user = users.find((u) => u.email === email);
  const ok = await bcrypt.compare(password, user ? user.hash : DUMMY_HASH);
  if (!user || !ok) {
    fails.set(key, { count: (f?.count || 0) + 1, first: f?.first || now });
    return res.status(401).json({ error: 'Correo o clave incorrectos.' });
  }

  fails.delete(key);
  const token = jwt.sign({ sub: user.uid, email: user.email }, SECRET, { expiresIn: EXPIRES });
  res.json({ token });
}

/** Verifica el token de sesión y que la cuenta siga existiendo en el .env. */
export function verify(token) {
  const payload = jwt.verify(token, SECRET);
  const user = users.find((u) => u.uid === payload.sub);
  if (!user) throw new Error('forbidden');
  return { uid: user.uid, email: user.email };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    req.user = verify(token);
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
  }
}
