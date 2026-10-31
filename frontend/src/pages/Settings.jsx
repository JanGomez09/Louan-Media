import { useRef, useState } from 'react';
import { Moon, Sun, LogOut, Camera } from 'lucide-react';
import { useApp } from '../AppContext';
import { Avatar } from '../components/Media';
import { prepareFile } from '../compress';

export default function Settings() {
  const { profile, updateProfile, setAvatar, signOut } = useApp();
  const [username, setUsername] = useState(profile.username);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);
  const dark = profile.theme === 'dark';

  const run = async (fn, ok) => {
    setMsg('');
    setError('');
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveName = (e) => {
    e.preventDefault();
    run(() => updateProfile({ username }), 'Nombre actualizado.');
  };

  const pickAvatar = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) run(async () => setAvatar(await prepareFile(file, 512, 0.85)), 'Foto de perfil actualizada.');
  };

  return (
    <section className="page narrow">
      <h1>Ajustes</h1>

      <div className="card pad">
        <div className="profile-row">
          <button className="avatar-btn" onClick={() => input.current.click()} aria-label="Cambiar foto de perfil">
            <Avatar person={profile} size={88} />
            <span className="avatar-cam"><Camera size={16} /></span>
          </button>
          <input ref={input} type="file" accept="image/*" hidden onChange={pickAvatar} />
          <div>
            <strong>{profile.username}</strong>
            <div className="muted small">{profile.email}</div>
          </div>
        </div>

        <form onSubmit={saveName}>
          <label>
            Nombre de usuario
            <input value={username} onChange={(e) => setUsername(e.target.value)} minLength={2} maxLength={30} required />
          </label>
          <button className="btn" disabled={username.trim() === profile.username}>Guardar nombre</button>
        </form>
        {msg && <p className="ok">{msg}</p>}
        {error && <p className="notice">{error}</p>}
      </div>

      <div className="card pad">
        <div className="row spread">
          <div>
            <strong>Tema</strong>
            <div className="muted small">{dark ? 'Oscuro' : 'Claro'}</div>
          </div>
          <button className="btn ghost" onClick={() => run(() => updateProfile({ theme: dark ? 'light' : 'dark' }))}>
            {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? 'Usar tema claro' : 'Usar tema oscuro'}
          </button>
        </div>
      </div>

      <button className="btn ghost" onClick={signOut}>
        <LogOut size={18} /> Cerrar sesión
      </button>
    </section>
  );
}
