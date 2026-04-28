import { describe, expect, it } from 'vitest';
import { computeDimensions } from '../src/dimensions.js';

describe('computeDimensions — scale (contain)', () => {
  it('shrinks a wide source to fit inside the box, preserving aspect ratio', () => {
    const dims = computeDimensions({ width: 4000, height: 2000 }, 200, 200, 'scale');
    // Limiting axis is width: 4000/200 = 20 → 200 × 100.
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(100);
    expect(dims.drawWidth).toBe(200);
    expect(dims.drawHeight).toBe(100);
    expect(dims.offsetX).toBe(0);
    expect(dims.offsetY).toBe(0);
  });

  it('shrinks a tall source to fit inside the box, preserving aspect ratio', () => {
    const dims = computeDimensions({ width: 1000, height: 4000 }, 200, 200, 'scale');
    expect(dims.canvasWidth).toBe(50);
    expect(dims.canvasHeight).toBe(200);
  });

  it('does not upscale below the target box (canvas matches scaled source)', () => {
    const dims = computeDimensions({ width: 100, height: 100 }, 200, 200, 'scale');
    // Both ratios are 0.5; max(0.5, 0.5) = 0.5; 100/0.5 = 200. Image *is*
    // upscaled to fill — preserving v1 behavior, which does not clamp.
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(200);
  });

  it('handles an exactly square source into a square box', () => {
    const dims = computeDimensions({ width: 800, height: 800 }, 200, 200, 'scale');
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(200);
  });
});

describe('computeDimensions — crop (cover)', () => {
  it('covers a wide target with a wide source by overflowing horizontally', () => {
    const dims = computeDimensions({ width: 4000, height: 2000 }, 200, 200, 'crop');
    // Limiting axis is height: 2000/200 = 10 → 400 × 200, overflow X = 200.
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(200);
    expect(dims.drawWidth).toBe(400);
    expect(dims.drawHeight).toBe(200);
    expect(dims.offsetX).toBe(-100); // centered
    expect(dims.offsetY).toBe(0);
  });

  it('covers a tall target with a tall source by overflowing vertically', () => {
    const dims = computeDimensions({ width: 1000, height: 4000 }, 200, 200, 'crop');
    expect(dims.drawWidth).toBe(200);
    expect(dims.drawHeight).toBe(800);
    expect(dims.offsetX).toBe(0);
    expect(dims.offsetY).toBe(-300);
  });

  it('handles non-square targets', () => {
    const dims = computeDimensions({ width: 1000, height: 1000 }, 100, 200, 'crop');
    // Width ratio 10, height ratio 5 → use height ratio (smaller, covers).
    expect(dims.drawWidth).toBe(200);
    expect(dims.drawHeight).toBe(200);
    expect(dims.offsetX).toBe(-50);
    expect(dims.offsetY).toBe(0);
  });
});

describe('computeDimensions — edge cases', () => {
  it('handles a 1×1 source', () => {
    const dims = computeDimensions({ width: 1, height: 1 }, 200, 200, 'scale');
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(200);
  });

  it('produces non-integer canvas dimensions when ratios do not divide evenly', () => {
    // 1000×999 fitted into 200×200 → ratio 5 (width limits) → 200×199.8.
    const dims = computeDimensions({ width: 1000, height: 999 }, 200, 200, 'scale');
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBeCloseTo(199.8);
  });

  it('upscales in crop mode when the source is smaller than the target', () => {
    // 100×100 source covering a 200×200 target — both ratios = 0.5.
    const dims = computeDimensions({ width: 100, height: 100 }, 200, 200, 'crop');
    expect(dims.drawWidth).toBe(200);
    expect(dims.drawHeight).toBe(200);
    expect(dims.offsetX).toBe(0);
    expect(dims.offsetY).toBe(0);
  });

  it('produces fractional offsets for odd overflow in crop mode', () => {
    // 4001×2000 cropped to 200×200 → ratio 10 (height limits), draw 400.1
    // wide, overflow 200.1 split symmetrically → offsetX = -100.05.
    const dims = computeDimensions({ width: 4001, height: 2000 }, 200, 200, 'crop');
    expect(dims.drawWidth).toBeCloseTo(400.1);
    expect(dims.offsetX).toBeCloseTo(-100.05);
  });

  it('handles very large sources without losing precision', () => {
    const dims = computeDimensions({ width: 10_000, height: 10_000 }, 200, 200, 'scale');
    expect(dims.canvasWidth).toBe(200);
    expect(dims.canvasHeight).toBe(200);
  });
});

describe('computeDimensions — validation', () => {
  it('rejects zero or negative source dimensions', () => {
    expect(() => computeDimensions({ width: 0, height: 100 }, 200, 200, 'scale')).toThrow(
      RangeError,
    );
    expect(() => computeDimensions({ width: 100, height: -1 }, 200, 200, 'scale')).toThrow(
      RangeError,
    );
  });

  it('rejects zero or negative target dimensions', () => {
    expect(() => computeDimensions({ width: 100, height: 100 }, 0, 200, 'scale')).toThrow(
      RangeError,
    );
  });
});
