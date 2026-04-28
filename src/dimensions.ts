import type { ResolvedDimensions, ScaleMode } from './types.js';

/**
 * Computes canvas size and draw rectangle for a source image fitted to a
 * target box.
 *
 * - `scale` preserves aspect ratio and shrinks the image to fit *inside*
 *   the target box. The canvas matches the scaled image, so the box
 *   acts as a maximum.
 * - `crop` fills the target box, scaling the image to cover it and
 *   centering any overflow off-canvas.
 */
export function computeDimensions(
  source: { width: number; height: number },
  targetWidth: number,
  targetHeight: number,
  mode: ScaleMode,
): ResolvedDimensions {
  if (source.width <= 0 || source.height <= 0) {
    throw new RangeError('Source image has zero or negative dimensions');
  }
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new RangeError('Target dimensions must be positive');
  }

  const widthRatio = source.width / targetWidth;
  const heightRatio = source.height / targetHeight;

  if (mode === 'crop') {
    // Cover: scale by the *smaller* ratio so the shorter side matches the
    // target and the longer side overflows. The overflow is centered.
    const ratio = Math.min(widthRatio, heightRatio);
    const drawWidth = source.width / ratio;
    const drawHeight = source.height / ratio;
    return {
      canvasWidth: targetWidth,
      canvasHeight: targetHeight,
      drawWidth,
      drawHeight,
      offsetX: (targetWidth - drawWidth) / 2,
      offsetY: (targetHeight - drawHeight) / 2,
    };
  }

  // Contain: scale by the *larger* ratio so the longer side fits and the
  // shorter side stays inside the box. The canvas shrinks to match.
  const ratio = Math.max(widthRatio, heightRatio);
  const canvasWidth = source.width / ratio;
  const canvasHeight = source.height / ratio;
  return {
    canvasWidth,
    canvasHeight,
    drawWidth: canvasWidth,
    drawHeight: canvasHeight,
    offsetX: 0,
    offsetY: 0,
  };
}
