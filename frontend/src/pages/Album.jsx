import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api, uploadToAlbum } from '../api';
import { useApp } from '../AppContext';
import { Media } from '../components/Media';
import { fmtDate } from './Dashboard';

export default function Album() {
  const { profile, getPerson } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    api.get('/media').then(setItems).catch((e) => setError(e.message));
  }, []);

  async function onFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    try {
      const added = await uploadToAlbum(files, (n, total) => setStatus(`Subiendo ${n} de ${total}…`));
      setItems((prev) => [...added.reverse(), ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus('');
    }
  }

  async function remove(item) {
    if (!window.confirm('¿Borrar del álbum? También se quitará de Inicio si estaba publicada.')) return;
    try {
      await api.del(`/media/${item.id}`);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setOpen(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Álbum de pareja</h1>
        <button className="btn" onClick={() => input.current.click()} disabled={!!status}>
          <Plus size={18} /> Agregar
        </button>
        <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />
      </div>
      {status && <p className="muted">{status}</p>}
      {error && <p className="notice">{error}</p>}
      {items === null && !error && <p className="muted">Cargando álbum…</p>}
      {items?.length === 0 && <div className="empty"><p>El álbum está vacío. Agrega la primera foto.</p></div>}
      <div className="grid">
        {items?.map((it) => (
          <button key={it.id} className="tile" onClick={() => setOpen(it)} aria-label="Abrir">
            <Media id={it.id} mime={it.mime} className="tile-media" />
          </button>
        ))}
      </div>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn close" onClick={() => setOpen(null)} aria-label="Cerrar"><X size={22} /></button>
            <Media id={open.id} mime={open.mime} className="lightbox-media" controls />
            <p className="muted small">Subida por {getPerson(open.owner_uid).username} · {fmtDate(open.created_at)}</p>
            <div className="row">
              <button className="btn" onClick={() => navigate(`/publicar?media=${open.id}`)}>Publicar</button>
              {open.owner_uid === profile.uid && (
                <button className="btn ghost" onClick={() => remove(open)}>Borrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
