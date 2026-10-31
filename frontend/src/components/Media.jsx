import { useEffect, useState } from 'react';
import { api } from '../api';

// Los archivos viven en MongoDB y requieren sesión, así que se descargan con el token
// y se muestran mediante una URL local. Se guardan en caché para no repetir descargas.
const cache = new Map();

function useMediaUrl(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!id) return setUrl(null);
    let alive = true;
    if (!cache.has(id)) {
      cache.set(
        id,
        api.blob(`/media/${id}/file`).then((b) => URL.createObjectURL(b))
      );
    }
    cache.get(id).then(
      (u) => alive && setUrl(u),
      () => cache.delete(id)
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function Media({ id, mime, className = '', controls = false }) {
  const url = useMediaUrl(id);
  if (!url) return <div className={`skeleton ${className}`} />;
  if (mime?.startsWith('video/')) {
    return <video src={url} className={className} controls={controls} playsInline preload="metadata" />;
  }
  return <img src={url} alt="" className={className} loading="lazy" />;
}

export function Avatar({ person, size = 40 }) {
  const url = useMediaUrl(person?.avatar_media_id);
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (url) return <img src={url} alt="" className="avatar" style={style} />;
  return (
    <span className="avatar avatar-fallback" style={style}>
      {(person?.username || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}
