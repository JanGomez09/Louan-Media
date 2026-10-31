# Uscial Media

Red social privada para dos personas: inicio con publicaciones (likes y comentarios), chat en tiempo real, álbum de pareja, publicar desde el álbum y ajustes (nombre, foto de perfil, tema claro/oscuro).

```
frontend/   React + Vite → GitHub Pages
backend/    Node + Express + Socket.IO → Render, Railway, Fly.io, tu PC con Tailscale, etc.
            └─ MongoDB: perfiles, publicaciones, chat y los archivos (fotos y videos, con GridFS)
```

Todo se guarda en MongoDB, así que los dos ven lo mismo desde cualquier dispositivo.

## Cómo funciona el acceso

- Los dos correos y el **hash bcrypt** de cada clave están en el `.env` del backend. Nunca se guardan claves en texto plano ni en el frontend (en GitHub Pages todo es público).
- El frontend envía correo y clave a `POST /auth/login`; si coinciden, el backend devuelve un token (JWT) que se usa en la API y en el chat. Cualquier otro correo es rechazado.
- Hay un límite de 5 intentos fallidos cada 15 minutos por IP y correo.

## 1. MongoDB

No hay tablas ni scripts: las colecciones se crean solas. Solo necesitas la cadena de conexión:

- **MongoDB Atlas (nube, plan gratuito M0, 512 MB):** crea un clúster y un usuario, y copia la cadena `mongodb+srv://...`. En *Network Access* permite la IP del backend; si lo despliegas en Render o Railway (IP variable) se usa `0.0.0.0/0`, protegido por el usuario y la clave.
- **Local:** instala MongoDB Community y usa `mongodb://localhost:27017` (MongoDB Compass sirve para ver los datos).

Las fotos y videos se guardan con **GridFS** dentro de MongoDB. Las fotos se comprimen en el navegador (máx. 1600 px, suelen pesar unos cientos de KB) y los videos tienen un límite de 25 MB, así que vigila el espacio si subes mucho video, sobre todo en el plan gratuito de Atlas.

## 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run hash -- "clave de la persona 1"   # → USER1_HASH
npm run hash -- "clave de la persona 2"   # → USER2_HASH
npm run secret                            # → JWT_SECRET
npm run dev                               # http://localhost:4000
```

Completa también `USER1_EMAIL`, `USER2_EMAIL`, `MONGODB_URI` y `FRONTEND_ORIGIN`. Deja cada hash entre **comillas simples** (`USER1_HASH='$2a$12$...'`).

Producción: crea un *Web Service* con raíz `backend`, comando `npm start` y las mismas variables del `.env`. `FRONTEND_ORIGIN` debe incluir `https://tu-usuario.github.io` (sin la ruta del repositorio). Como GitHub Pages usa HTTPS, el backend también necesita HTTPS (Render y Railway lo dan; con Tailscale sirve `tailscale funnel`).

Cambiar una clave: genera un hash nuevo, reemplázalo en las variables del hosting y reinicia. Si cambias `JWT_SECRET`, se cierran todas las sesiones.

## 3. Frontend

```bash
cd frontend
cp .env.example .env     # VITE_API_URL = URL del backend
npm install
npm run dev              # http://localhost:5173
```

### Publicar en GitHub Pages

1. Sube el proyecto a GitHub (rama `main`).
2. **Settings → Pages → Source:** *GitHub Actions*.
3. **Settings → Secrets and variables → Actions → Variables:** crea `VITE_API_URL` con la URL pública del backend.
4. Cada push a `main` que toque `frontend/` publica el sitio con `.github/workflows/deploy-frontend.yml`.

## Notas

- **Servicios gratuitos que se duermen:** la primera petición tras un rato sin uso puede tardar unos segundos.
- **Un solo usuario aparece como "Tu pareja"** hasta que la otra persona inicie sesión por primera vez (ahí se crea su perfil).
- **Sin recuperación de clave por correo:** se genera un hash nuevo como se explica arriba.
