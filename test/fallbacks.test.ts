import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tune } from '../src/index.js';

/**
 * Exercises the legacy fallback paths that real Safari < 17 and old
 * mobile browsers hit: FileReader + <img> instead of createImageBitmap,
 * and HTMLCanvasElement.toBlob instead of OffscreenCanvas.convertToBlob.
 *
 * happy-dom doesn't provide working Image decoding or canvas encoding,
 * so we hand-stub both with deterministic event ordering.
 */

interface FakeImageInstance {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  width: number;
  height: number;
}

interface FakeReaderInstance {
  result: string | null;
  error: Error | null;
  onloadend: (() => void) | null;
  onerror: (() => void) | null;
  abort: () => void;
  readAsDataURL: (b: Blob) => void;
  _aborted: boolean;
}

let lastImage: FakeImageInstance | null = null;
let lastReader: FakeReaderInstance | null = null;
let canvasToBlobCalledWith: { type: string | undefined; quality: number | undefined } | undefined;

function makeFakeImage(): FakeImageInstance {
  const img: FakeImageInstance = {
    src: '',
    onload: null,
    onerror: null,
    width: 4000,
    height: 2000,
  };
  // When src is set to a non-empty string, fire onload on next microtask.
  // Setting src='' is interpreted as "cancel" and fires nothing.
  Object.defineProperty(img, 'src', {
    get() {
      return (this as unknown as { _src: string })._src ?? '';
    },
    set(v: string) {
      (this as unknown as { _src: string })._src = v;
      if (v) {
        queueMicrotask(() => img.onload?.());
      }
    },
    configurable: true,
  });
  return img;
}

function makeFakeReader(): FakeReaderInstance {
  const reader: FakeReaderInstance = {
    result: null,
    error: null,
    onloadend: null,
    onerror: null,
    _aborted: false,
    abort() {
      this._aborted = true;
    },
    readAsDataURL(_b: Blob) {
      queueMicrotask(() => {
        if (reader._aborted) return;
        reader.result = 'data:image/jpeg;base64,QUFB';
        reader.onloadend?.();
      });
    },
  };
  return reader;
}

beforeEach(() => {
  lastImage = null;
  lastReader = null;
  canvasToBlobCalledWith = undefined;

  // Force the FileReader/<img> fallback by hiding createImageBitmap.
  vi.stubGlobal('createImageBitmap', undefined);
  // Force the HTMLCanvasElement fallback by hiding OffscreenCanvas.
  vi.stubGlobal('OffscreenCanvas', undefined);

  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        lastImage = makeFakeImage();
        // biome-ignore lint/correctness/noConstructorReturn: stub
        return lastImage as unknown as object;
      }
    },
  );
  vi.stubGlobal(
    'FileReader',
    class {
      constructor() {
        lastReader = makeFakeReader();
        // biome-ignore lint/correctness/noConstructorReturn: stub
        return lastReader as unknown as object;
      }
    },
  );

  // Stub document.createElement('canvas') to a fake HTMLCanvasElement
  // that records toBlob args and calls back with a Blob.
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return realCreateElement(tag);
    const ctx = {
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
      drawImage: () => {},
    };
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => {
        canvasToBlobCalledWith = { type, quality };
        queueMicrotask(() => cb(new Blob(['x'], { type: type ?? 'image/png' })));
      },
    } as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FileReader + <img> fallback', () => {
  it('decodes via FileReader.readAsDataURL → image.onload', async () => {
    const blob = await tune(new Blob(['fake']), { type: 'png' });
    expect(blob).toBeInstanceOf(Blob);
    expect(lastReader).not.toBeNull();
    expect(lastImage).not.toBeNull();
    expect(lastImage?.src).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('rejects when image decode fails', async () => {
    // Override the Image stub to fire onerror instead of onload.
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          const img = makeFakeImage();
          Object.defineProperty(img, 'src', {
            set() {
              queueMicrotask(() => img.onerror?.());
            },
            configurable: true,
          });
          lastImage = img;
          // biome-ignore lint/correctness/noConstructorReturn: stub
          return img as unknown as object;
        }
      },
    );
    await expect(tune(new Blob(['fake']))).rejects.toThrow(/decode/i);
  });

  it('rejects when FileReader fails', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        constructor() {
          const reader = makeFakeReader();
          reader.readAsDataURL = () => {
            queueMicrotask(() => {
              reader.error = new Error('disk gone');
              reader.onerror?.();
            });
          };
          lastReader = reader;
          // biome-ignore lint/correctness/noConstructorReturn: stub
          return reader as unknown as object;
        }
      },
    );
    await expect(tune(new Blob(['fake']))).rejects.toThrow('disk gone');
  });

  it('aborts mid-read by calling reader.abort() and clearing image.src', async () => {
    const ctrl = new AbortController();
    const promise = tune(new Blob(['fake']), { signal: ctrl.signal });
    // Abort before the FileReader microtask fires.
    ctrl.abort();
    await expect(promise).rejects.toThrow();
    expect(lastReader?._aborted).toBe(true);
  });
});

describe('HTMLCanvasElement.toBlob fallback', () => {
  it('encodes via canvas.toBlob with the requested mime + quality', async () => {
    await tune(new Blob(['fake']), { type: 'webp', quality: 75 });
    expect(canvasToBlobCalledWith).toEqual({ type: 'image/webp', quality: 0.75 });
  });

  it('rejects when toBlob returns null (encoder failure)', async () => {
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') throw new Error('unexpected');
      return {
        width: 0,
        height: 0,
        getContext: () => ({ imageSmoothingQuality: 'low', drawImage: () => {} }),
        toBlob: (cb: (b: Blob | null) => void) => queueMicrotask(() => cb(null)),
      } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
    await expect(tune(new Blob(['fake']))).rejects.toThrow(/encoding failed/i);
  });
});
