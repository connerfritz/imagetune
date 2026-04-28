# ImageTune

Tiny zero-dependency browser library for client-side image resizing,
cropping, and format conversion. Takes a `File` (typically from
`<input type="file">`) and returns an encoded `Blob` so apps can downscale
and re-encode large photos *before* upload — saving bandwidth, server
processing time, and storage.

> **v2 highlights:** TypeScript types, ESM + CJS + UMD builds, WebP
> output, `OffscreenCanvas` decoding, `AbortSignal` cancellation, and
> proper rejection of malformed inputs. See [Migrating from v1](#migrating-from-v1).

```bash
npm install imagetune
# or: pnpm add imagetune  /  yarn add imagetune  /  bun add imagetune
```

## Usage

```ts
import { tune } from 'imagetune';

const file = (document.querySelector<HTMLInputElement>('#file'))!.files![0];

const blob = await tune(file, {
  type: 'webp',
  quality: 80,
  width: 250,
  height: 250,
  mode: 'crop',
});

// Preview:
preview.src = URL.createObjectURL(blob);

// Or upload directly:
const fd = new FormData();
fd.append('image', blob, 'avatar.webp');
await fetch('/upload', { method: 'POST', body: fd });
```

Need a base64 data URL (v1 behavior) instead of a Blob?

```ts
import { tuneToDataURL } from 'imagetune';
const dataUrl = await tuneToDataURL(file, { type: 'webp', quality: 80 });
```

Drop-in `<script>` tag (UMD/IIFE build, exposes `window.ImageTune`):

```html
<script src="https://unpkg.com/imagetune"></script>
<script>
  ImageTune.tune(file, { type: 'webp', quality: 80 }).then(blob => { ... });
</script>
```

## Options

| Name               | Type                                            | Default  | Description                                                |
|--------------------|-------------------------------------------------|----------|------------------------------------------------------------|
| `width`            | `number`                                        | `200`    | Target width in pixels.                                    |
| `height`           | `number`                                        | `200`    | Target height in pixels.                                   |
| `quality`          | `number` (1–100)                                | `100`    | Encoder quality. Ignored for `png` (lossless).             |
| `type`             | `'jpeg' \| 'jpg' \| 'png' \| 'webp'`            | `'jpeg'` | Output format. `'jpg'` is an alias for `'jpeg'`.           |
| `mode`             | `'scale' \| 'crop'`                             | `'scale'`| `scale` fits inside the box; `crop` covers and centers.    |
| `smoothingQuality` | `'low' \| 'medium' \| 'high'`                   | `'high'` | Canvas `imageSmoothingQuality`.                            |
| `signal`           | `AbortSignal`                                   | —        | Cancel decoding/encoding (e.g. when the input changes).    |

## Migrating from v1

| Change                                  | Action                                                                  |
|-----------------------------------------|-------------------------------------------------------------------------|
| `tune()` resolves with a `Blob`         | Use `URL.createObjectURL(blob)` for previews, or `tuneToDataURL()`.     |
| `gif` output removed                    | It silently fell back to PNG anyway. Pass `'png'` (or `'webp'`).        |
| Errors now reject the promise           | Add `.catch(...)` (or wrap in `try/await`). v1 silently hung instead.   |
| No more global UMD via bare `index.js`  | Use the `unpkg` build or `import` from the package.                     |

The default options are unchanged; same target dimensions, same JPEG default.

## Browser support

Modern evergreen browsers. The library prefers `createImageBitmap` and
`OffscreenCanvas`, falling back to `FileReader` + `<img>` + `HTMLCanvasElement`
when those aren't available.

**AVIF input** is decoded by every modern browser, so `tune()` happily
accepts AVIF blobs as input. **AVIF output** is not currently supported
in the canvas APIs of any production browser as of early 2026 —
`canvas.convertToBlob({ type: 'image/avif' })` rejects everywhere — so
`'avif'` is intentionally absent from the `type` enum. Pick `'webp'` if
you want broad encoder support with strong compression.

> **Cancellation note.** Browsers don't expose a way to truly cancel an
> in-flight `createImageBitmap` decode or `convertToBlob` encode. When
> `signal` aborts during one of those steps, the promise rejects
> immediately and any decoded `ImageBitmap` is `.close()`d, but the
> underlying decode/encode work runs to completion in the background.
> For UI flows where the user is rapidly switching files, this still
> drops the unwanted result on the floor — just don't expect CPU work
> to stop instantly.

## Development

```bash
pnpm install
pnpm dev          # rebuild on change
pnpm test         # vitest
pnpm typecheck
pnpm lint
pnpm build
```

Open `examples/index.html` after a build to try it in a browser.

Releases are automated via [semantic-release](https://github.com/semantic-release/semantic-release):
merge a Conventional Commit to `main` and a new npm version is published
with provenance, a GitHub Release, and an updated `CHANGELOG.md`.

Authentication uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC) — there is no `NPM_TOKEN` secret. `@semantic-release/npm` is
configured with `npmPublish: false`, so it bumps `package.json` but
skips publishing; the actual `npm publish --provenance --access public`
runs via `@semantic-release/exec` and uses the npm CLI's native OIDC
flow. The release workflow has `id-token: write` and the package is
configured on npmjs.com to trust this repo's `release.yml` workflow.

## License

ISC. See [LICENSE](./LICENSE).
