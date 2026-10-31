import { useState } from 'react';
import { useApp } from '../AppContext';
import { Brand } from '../components/Layout';

export default function Login() {
  const { signIn, authError } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <p className="muted">Un lugar solo para ustedes dos.</p>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Clave
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {(msg || authError) && <p className="notice">{msg || authError}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
