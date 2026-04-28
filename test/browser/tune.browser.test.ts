import { describe, expect, it } from 'vitest';
import { tune, tuneToDataURL } from '../../src/index.js';

/**
 * End-to-end smoke tests that run in real Chromium via Playwright. These
 * exercise the actual `createImageBitmap`, `OffscreenCanvas`, and encoder
 * paths — the things happy-dom can't model. We generate fixtures on the
 * fly with a canvas to avoid committing binary blobs.
 */

async function makeFixturePng(width: number, height: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable in test env');
  // Two-tone fill so the encoder has actual content to compress.
  ctx.fillStyle = '#ff3366';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#3366ff';
  ctx.fillRect(0, 0, width / 2, height / 2);
  return await canvas.convertToBlob({ type: 'image/png' });
}

async function decodeBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

describe('tune (real browser)', () => {
  it('round-trips a 2000×1000 PNG to WebP and shrinks to fit 250×250', async () => {
    const source = await makeFixturePng(2000, 1000);
    const out = await tune(source, { type: 'webp', quality: 80, width: 250, height: 250 });

    expect(out).toBeInstanceOf(Blob);
    expect(out.type).toBe('image/webp');
    expect(out.size).toBeGreaterThan(0);
    expect(out.size).toBeLessThan(source.size); // re-encoded should be smaller

    const dims = await decodeBlobDimensions(out);
    // 2000×1000 fitted into 250×250 (scale mode) → 250×125.
    expect(dims.width).toBe(250);
    expect(dims.height).toBe(125);
  });

  it('crops to fill the target box in crop mode', async () => {
    const source = await makeFixturePng(4000, 2000);
    const out = await tune(source, { type: 'png', width: 200, height: 200, mode: 'crop' });

    const dims = await decodeBlobDimensions(out);
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(200);
  });

  it('encodes JPEG with quality control', async () => {
    const source = await makeFixturePng(800, 800);
    const high = await tune(source, { type: 'jpeg', quality: 95, width: 800, height: 800 });
    const low = await tune(source, { type: 'jpeg', quality: 10, width: 800, height: 800 });
    expect(high.type).toBe('image/jpeg');
    expect(low.type).toBe('image/jpeg');
    expect(low.size).toBeLessThan(high.size); // lower quality = smaller file
  });

  it('rejects when AbortSignal fires before decoding', async () => {
    const source = await makeFixturePng(100, 100);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(tune(source, { signal: ctrl.signal })).rejects.toThrow();
  });

  it('resolves tuneToDataURL with a real data: URL', async () => {
    const source = await makeFixturePng(100, 100);
    const url = await tuneToDataURL(source, { type: 'png', width: 50, height: 50 });
    expect(url).toMatch(/^data:image\/png;base64,/);
    // Round-trip the data URL through fetch + decode to verify it's valid.
    const decoded = await (await fetch(url)).blob();
    const dims = await decodeBlobDimensions(decoded);
    expect(dims.width).toBe(50);
    expect(dims.height).toBe(50);
  });

  it('produces WebP output that re-decodes successfully', async () => {
    const source = await makeFixturePng(500, 500);
    const out = await tune(source, { type: 'webp', quality: 70, width: 200, height: 200 });
    const dims = await decodeBlobDimensions(out);
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(200);
  });
});
