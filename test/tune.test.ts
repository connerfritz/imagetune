import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tune, tuneToDataURL } from '../src/index.js';

/**
 * happy-dom doesn't render canvas pixels, so these tests focus on the
 * parts of the pipeline that don't need a real GPU/encoder: option
 * validation, format mapping, and abort plumbing. We stub the bitmap
 * loader and the OffscreenCanvas encoder so the orchestration runs end
 * to end and we can assert what the encoder was asked to produce.
 */

interface MockedCanvas {
  width: number;
  height: number;
  drawn: Array<unknown>;
  smoothing: ImageSmoothingQuality | undefined;
  convertCalledWith: { type: string; quality: number } | undefined;
}

let mockCanvas: MockedCanvas;

class StubBitmap {
  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}
  closed = false;
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  mockCanvas = {
    width: 0,
    height: 0,
    drawn: [],
    smoothing: undefined,
    convertCalledWith: undefined,
  };

  // Stub createImageBitmap → returns a fake ImageBitmap-like object.
  vi.stubGlobal('createImageBitmap', async (_blob: Blob) => new StubBitmap(4000, 2000));
  // Make `instanceof ImageBitmap` work so tune()'s finally{} closes it.
  vi.stubGlobal('ImageBitmap', StubBitmap);

  // Stub OffscreenCanvas with a hand-rolled 2D context that records calls.
  class StubOffscreenCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {
      mockCanvas.width = width;
      mockCanvas.height = height;
    }
    getContext(_kind: string) {
      return {
        set imageSmoothingQuality(v: ImageSmoothingQuality) {
          mockCanvas.smoothing = v;
        },
        drawImage: (...args: unknown[]) => {
          mockCanvas.drawn.push(args);
        },
      };
    }
    convertToBlob(opts: { type: string; quality: number }) {
      mockCanvas.convertCalledWith = opts;
      return Promise.resolve(new Blob(['x'], { type: opts.type }));
    }
  }
  vi.stubGlobal('OffscreenCanvas', StubOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tune', () => {
  it('returns a Blob with the requested mime type', async () => {
    const blob = await tune(new Blob(['fake']), { type: 'webp', quality: 80 });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/webp');
    expect(mockCanvas.convertCalledWith).toEqual({ type: 'image/webp', quality: 0.8 });
  });

  it('treats `jpg` as an alias for jpeg', async () => {
    const blob = await tune(new Blob(['fake']), { type: 'jpg' });
    expect(blob.type).toBe('image/jpeg');
  });

  it('defaults to jpeg + 200×200 + scale + quality 100', async () => {
    await tune(new Blob(['fake']));
    expect(mockCanvas.convertCalledWith).toEqual({ type: 'image/jpeg', quality: 1 });
    // 4000×2000 source scaled to fit in 200×200 → 200×100.
    expect(mockCanvas.width).toBe(200);
    expect(mockCanvas.height).toBe(100);
  });

  it('crops to fill the target box', async () => {
    await tune(new Blob(['fake']), { mode: 'crop', width: 200, height: 200 });
    expect(mockCanvas.width).toBe(200);
    expect(mockCanvas.height).toBe(200);
  });

  it('rejects out-of-range quality values', async () => {
    await expect(tune(new Blob(['fake']), { quality: 0 })).rejects.toThrow(RangeError);
    await expect(tune(new Blob(['fake']), { quality: 101 })).rejects.toThrow(RangeError);
  });

  it('rejects unknown formats', async () => {
    await expect(
      // @ts-expect-error — exercising the runtime guard
      tune(new Blob(['fake']), { type: 'bmp' }),
    ).rejects.toThrow(TypeError);
  });

  it('honors AbortSignal before decoding starts', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(tune(new Blob(['fake']), { signal: ctrl.signal })).rejects.toThrow();
  });

  it('forwards smoothingQuality to the canvas context', async () => {
    await tune(new Blob(['fake']), { smoothingQuality: 'low' });
    expect(mockCanvas.smoothing).toBe('low');
  });
});

describe('tuneToDataURL', () => {
  it('resolves with a data: URL string', async () => {
    const url = await tuneToDataURL(new Blob(['fake']), { type: 'png' });
    expect(url.startsWith('data:image/png')).toBe(true);
  });
});
