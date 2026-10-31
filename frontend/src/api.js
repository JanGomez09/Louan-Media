import { prepareFile } from './compress';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const TOKEN_KEY = 'uscial_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

const NETWORK_ERROR = 'No se pudo conectar con el servidor. Inténtalo de nuevo en unos segundos.';

/** Inicia sesión contra el backend y guarda el token. */
export async function login(email, password) {
  let res;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
  setToken(data.token);
}

async function call(path, { method = 'GET', body, form } = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null); // sesión vencida: vuelve al login
      window.dispatchEvent(new Event('uscial:unauthorized'));
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res;
}

const json = async (p, o) => (await call(p, o)).json();

export const api = {
  get: (p) => json(p),
  post: (p, body) => json(p, { method: 'POST', body }),
  patch: (p, body) => json(p, { method: 'PATCH', body }),
  del: (p) => json(p, { method: 'DELETE' }),
  upload: (p, form) => json(p, { method: 'POST', form }),
  blob: async (p) => (await call(p)).blob(),
};

/** Comprime y sube archivos al álbum, de uno en uno. */
export async function uploadToAlbum(files, onProgress) {
  const out = [];
  let n = 0;
  for (const f of files) {
    onProgress?.(++n, files.length);
    const prepared = await prepareFile(f);
    const form = new FormData();
    form.append('files', prepared);
    out.push(...(await api.upload('/media', form)));
  }
  return out;
}
