import { computeDimensions } from './dimensions.js';
import type { LoadedImage } from './load-image.js';
import type { OutputFormatInput, TuneOptions } from './types.js';

const FORMAT_TO_MIME: Record<OutputFormatInput, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 200;

export async function renderToBlob(source: LoadedImage, options: TuneOptions): Promise<Blob> {
  const { mime, quality, signal, smoothing, dims } = resolve(source, options);

  signal?.throwIfAborted();

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(dims.canvasWidth, dims.canvasHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.imageSmoothingQuality = smoothing;
    ctx.drawImage(source, dims.offsetX, dims.offsetY, dims.drawWidth, dims.drawHeight);
    signal?.throwIfAborted();
    return await canvas.convertToBlob({ type: mime, quality });
  }

  const canvas = document.createElement('canvas');
  canvas.width = dims.canvasWidth;
  canvas.height = dims.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingQuality = smoothing;
  ctx.drawImage(source, dims.offsetX, dims.offsetY, dims.drawWidth, dims.drawHeight);
  signal?.throwIfAborted();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      mime,
      quality,
    );
  });
}

function resolve(source: LoadedImage, options: TuneOptions) {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const mode = options.mode ?? 'scale';
  const qualityRaw = options.quality ?? 100;

  if (qualityRaw < 1 || qualityRaw > 100) {
    throw new RangeError(`Invalid quality value: ${qualityRaw}. Must be 1–100.`);
  }

  const formatKey = options.type ?? 'jpeg';
  const mime = FORMAT_TO_MIME[formatKey];
  if (!mime) {
    throw new TypeError(`Unsupported image format: ${String(options.type)}`);
  }

  return {
    mime,
    quality: qualityRaw / 100,
    signal: options.signal,
    smoothing: options.smoothingQuality ?? 'high',
    dims: computeDimensions({ width: source.width, height: source.height }, width, height, mode),
  };
}
