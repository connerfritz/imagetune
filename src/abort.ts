/**
 * Settles `promise` unless `signal` aborts first. If it aborts after the
 * promise has already resolved with a closeable resource, `onAbortCleanup`
 * gets a chance to release it (the browser doesn't expose abortable
 * versions of `createImageBitmap` or `convertToBlob`, so this is the best
 * we can do without leaking).
 */
export function raceAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  onAbortCleanup?: (value: T) => void,
): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) {
          onAbortCleanup?.(value);
          reject(signal.reason);
        } else {
          resolve(value);
        }
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}
