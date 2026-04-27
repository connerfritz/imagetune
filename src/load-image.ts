export type LoadedImage = ImageBitmap | HTMLImageElement;

/**
 * Decodes a Blob into something drawable on a canvas.
 *
 * Prefers `createImageBitmap` (off-main-thread decode, faster, returns an
 * `ImageBitmap` we can `.close()` to release memory). Falls back to
 * `FileReader` + `<img>` for environments that don't expose it.
 */
export async function loadImage(file: Blob, signal?: AbortSignal): Promise<LoadedImage> {
  signal?.throwIfAborted();

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    if (signal?.aborted) {
      bitmap.close();
      signal.throwIfAborted();
    }
    return bitmap;
  }

  return await loadViaFileReader(file, signal);
}

function loadViaFileReader(file: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const image = new Image();

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      try {
        reader.abort();
      } catch {
        // FileReader.abort throws if no read is in progress; ignore.
      }
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Failed to decode image data'));
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        image.src = reader.result;
      } else {
        cleanup();
        reject(new Error('Unexpected FileReader result'));
      }
    };

    reader.readAsDataURL(file);
  });
}
