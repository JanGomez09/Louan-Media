export const MAX_VIDEO_MB = 25;

/**
 * Prepara un archivo antes de subirlo: las fotos se redimensionan y comprimen
 * en el navegador para no saturar MongoDB; los videos solo se validan.
 */
export async function prepareFile(file, maxSide = 1600, quality = 0.82) {
  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      throw new Error(`"${file.name}" supera el límite de ${MAX_VIDEO_MB} MB.`);
    }
    return file;
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" no es una foto ni un video.`);
  }
  if (file.type === 'image/gif') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`No se pudo leer "${file.name}". Prueba con un JPG o PNG.`);
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
