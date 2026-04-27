export type ScaleMode = 'scale' | 'crop';

export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/**
 * `'jpg'` is accepted as an alias for `'jpeg'` to ease migration from v1.
 * `'gif'` is intentionally absent — `canvas.toBlob('image/gif')` silently
 * falls back to PNG in every major browser, so v1 never actually emitted GIFs.
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
