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
  drawn: Array<unknown[]>;
  smoothing: ImageSmoothingQuality | undefined;
  convertCalledWith: { type: string; quality: number } | undefined;
}

let mockCanvas: MockedCanvas;
let lastBitmap: StubBitmap | null = null;
let convertResolver: ((blob: Blob) => void) | null = null;

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
  lastBitmap = null;
  convertResolver = null;

  vi.stubGlobal('createImageBitmap', async (_blob: Blob) => {
    lastBitmap = new StubBitmap(4000, 2000);
    return lastBitmap;
  });
  vi.stubGlobal('ImageBitmap', StubBitmap);

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
      return new Promise<Blob>((resolve) => {
        convertResolver = resolve;
        // Default: resolve next microtask so most tests don't have to
        // touch convertResolver. Tests that want to control timing can
        // null this out before tune() runs.
        queueMicrotask(() => convertResolver?.(new Blob(['x'], { type: opts.type })));
      });
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

  it('accepts quality boundaries 1 and 100', async () => {
    await tune(new Blob(['fake']), { quality: 1 });
    expect(mockCanvas.convertCalledWith?.quality).toBeCloseTo(0.01);
    await tune(new Blob(['fake']), { quality: 100 });
    expect(mockCanvas.convertCalledWith?.quality).toBe(1);
  });

  it('rejects NaN and Infinity quality (would silently divide to NaN)', async () => {
    await expect(tune(new Blob(['fake']), { quality: Number.NaN })).rejects.toThrow(RangeError);
    await expect(tune(new Blob(['fake']), { quality: Number.POSITIVE_INFINITY })).rejects.toThrow(
      RangeError,
    );
  });

  it('maps every supported format to its mime type', async () => {
    const cases: Array<[Required<NonNullable<Parameters<typeof tune>[1]>>['type'], string]> = [
      ['jpeg', 'image/jpeg'],
      ['jpg', 'image/jpeg'],
      ['png', 'image/png'],
      ['webp', 'image/webp'],
      ['avif', 'image/avif'],
    ];
    for (const [type, mime] of cases) {
      await tune(new Blob(['fake']), { type });
      expect(mockCanvas.convertCalledWith?.type).toBe(mime);
    }
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

  it('aborts mid-encode and closes the bitmap', async () => {
    // Replace the convertToBlob stub with one that never resolves on its
    // own; we'll abort while the encode is pending.
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
        }
        getContext() {
          return { imageSmoothingQuality: 'high', drawImage: () => {} };
        }
        convertToBlob() {
          return new Promise<Blob>(() => {
            /* never resolves */
          });
        }
      },
    );
    const ctrl = new AbortController();
    const promise = tune(new Blob(['fake']), { signal: ctrl.signal });
    queueMicrotask(() => ctrl.abort());
    await expect(promise).rejects.toThrow();
    expect(lastBitmap?.closed).toBe(true);
  });

  it('forwards smoothingQuality to the canvas context', async () => {
    await tune(new Blob(['fake']), { smoothingQuality: 'low' });
    expect(mockCanvas.smoothing).toBe('low');
  });

  it('defaults smoothingQuality to high', async () => {
    await tune(new Blob(['fake']));
    expect(mockCanvas.smoothing).toBe('high');
  });

  it('closes the source bitmap in finally{} on the success path', async () => {
    await tune(new Blob(['fake']));
    expect(lastBitmap?.closed).toBe(true);
  });

  it('closes the source bitmap in finally{} when render rejects', async () => {
    await expect(tune(new Blob(['fake']), { quality: 999 })).rejects.toThrow(RangeError);
    expect(lastBitmap?.closed).toBe(true);
  });

  it('forwards drawImage args (offset + draw rect) from dimensions', async () => {
    await tune(new Blob(['fake']), { mode: 'crop', width: 200, height: 200 });
    // 4000×2000 source, crop to 200×200: cover ratio = 10 (height limits),
    // draw 400×200, offsetX = -100, offsetY = 0.
    const [src, ox, oy, dw, dh] = mockCanvas.drawn[0] ?? [];
    expect(src).toBe(lastBitmap);
    expect(ox).toBe(-100);
    expect(oy).toBe(0);
    expect(dw).toBe(400);
    expect(dh).toBe(200);
  });

  it('respects custom width/height in scale mode', async () => {
    await tune(new Blob(['fake']), { width: 400, height: 400, mode: 'scale' });
    // 4000×2000 fitted into 400×400 → 400×200.
    expect(mockCanvas.width).toBe(400);
    expect(mockCanvas.height).toBe(200);
  });
});

describe('tuneToDataURL', () => {
  it('resolves with a data: URL string', async () => {
    const url = await tuneToDataURL(new Blob(['fake']), { type: 'png' });
    expect(url.startsWith('data:image/png')).toBe(true);
  });

  it('rejects when the post-encode FileReader fails', async () => {
    // FileReader.readAsDataURL on the encoded Blob is expected to succeed
    // in happy-dom; force a failure by overriding FileReader globally.
    class FailingReader {
      result: null = null;
      error = new Error('reader broke');
      onerror: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
      abort() {}
    }
    vi.stubGlobal('FileReader', FailingReader);
    await expect(tuneToDataURL(new Blob(['fake']))).rejects.toThrow('reader broke');
  });
});
