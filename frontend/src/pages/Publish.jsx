import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, uploadToAlbum } from '../api';
import { useApp } from '../AppContext';
import { Media } from '../components/Media';

export default function Publish() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(params.get('media') || null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    api.get('/media').then(setItems).catch((e) => setError(e.message));
  }, []);

  const shown = (items || []).filter((i) =>
    filter === 'all' ? true : filter === 'mine' ? i.owner_uid === profile.uid : i.owner_uid !== profile.uid
  );
  const current = items?.find((i) => i.id === selected);

  async function onFile(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    try {
      const [added] = await uploadToAlbum(files.slice(0, 1));
      setItems((prev) => [added, ...prev]);
      setSelected(added.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError('');
    try {
      await api.post('/posts', { mediaId: selected, caption });
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="page narrow">
      <h1>Publicar</h1>

      {current ? (
        <div className="card preview">
          <Media id={current.id} mime={current.mime} className="post-media" controls />
          <div className="post-body">
            <label>
              Descripción
              <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="Cuenta algo de este momento" />
            </label>
            {error && <p className="notice">{error}</p>}
            <div className="row">
              <button className="btn" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Publicar en Inicio'}</button>
              <button className="btn ghost" onClick={() => setSelected(null)} disabled={busy}>Cambiar foto</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="page-head">
            <p className="muted">Elige una foto del álbum para publicar.</p>
            <button className="btn ghost" onClick={() => input.current.click()} disabled={busy}>
              <Plus size={18} /> Subir nueva
            </button>
            <input ref={input} type="file" accept="image/*,video/*" hidden onChange={onFile} />
          </div>
          <div className="chips" role="tablist">
            {[['all', 'Todas'], ['mine', 'Mías'], ['theirs', 'De mi pareja']].map(([k, label]) => (
              <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          {error && <p className="notice">{error}</p>}
          {items === null && !error && <p className="muted">Cargando álbum…</p>}
          {items && shown.length === 0 && <div className="empty"><p>No hay fotos en esta vista.</p></div>}
          <div className="grid">
            {shown.map((it) => (
              <button key={it.id} className="tile" onClick={() => setSelected(it.id)} aria-label="Elegir foto">
                <Media id={it.id} mime={it.mime} className="tile-media" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
