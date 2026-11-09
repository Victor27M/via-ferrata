/**
 * Downscale to ≤1600 px on the long edge and re-encode as JPEG.
 * iOS hands HEIC photos to <input type=file> already converted to JPEG, and <img> applies EXIF orientation.
 */
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not encode image');
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
