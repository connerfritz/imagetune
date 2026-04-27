import { loadImage } from './load-image.js';
import { renderToBlob } from './render.js';
import type { TuneOptions } from './types.js';

export type { OutputFormat, OutputFormatInput, ScaleMode, TuneOptions } from './types.js';

/**
 * Resize / crop / re-encode an image File or Blob.
 *
 * Resolves with the encoded `Blob` (use `URL.createObjectURL(blob)` for
 * previewing or attach it directly to a `FormData` upload). For a base64
 * data URL, see {@link tuneToDataURL}.
 */
export async function tune(file: Blob, options: TuneOptions = {}): Promise<Blob> {
  const source = await loadImage(file, options.signal);
  try {
    return await renderToBlob(source, options);
  } finally {
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      source.close();
    }
  }
}

/** Like {@link tune}, but resolves with a base64 `data:` URL (v1-compatible). */
export async function tuneToDataURL(file: Blob, options: TuneOptions = {}): Promise<string> {
  const blob = await tune(file, options);
  options.signal?.throwIfAborted();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => options.signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      try {
        reader.abort();
      } catch {
        // FileReader.abort throws if no read is in progress; ignore.
      }
      reject(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error('Failed to read result'));
    };
    reader.onloadend = () => {
      cleanup();
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected FileReader result'));
    };
    reader.readAsDataURL(blob);
  });
}

/** Convenience namespace for v1-style `ImageTune.tune(...)` usage. */
export const ImageTune = { tune, tuneToDataURL };
