export type ScaleMode = 'scale' | 'crop';

export type OutputFormat = 'jpeg' | 'png' | 'webp';

/**
 * `'jpg'` is accepted as an alias for `'jpeg'` to ease migration from v1.
 *
 * `'gif'` and `'avif'` are intentionally absent:
 *   - `canvas.toBlob('image/gif')` silently falls back to PNG in every
 *     major browser, so v1 never actually emitted GIFs.
 *   - `canvas.convertToBlob({ type: 'image/avif' })` is not implemented
 *     in any production browser as of early 2026 — encoding rejects with
 *     "The encoding operation failed". AVIF *decoding* is universal, so
 *     `tune()` happily reads AVIF *input*; it just can't produce it.
 */
export type OutputFormatInput = OutputFormat | 'jpg';

export interface TuneOptions {
  width?: number;
  height?: number;
  /** Encoder quality, 1–100. Ignored for lossless formats (png). */
  quality?: number;
  type?: OutputFormatInput;
  mode?: ScaleMode;
  smoothingQuality?: ImageSmoothingQuality;
  signal?: AbortSignal;
}

export interface ResolvedDimensions {
  canvasWidth: number;
  canvasHeight: number;
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
}
