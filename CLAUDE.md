# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**ImageTune** is a tiny, zero-dependency browser library for client-side image
resizing, cropping, and format conversion. It takes a `File` (typically from an
`<input type="file">`) and returns a data URL of the processed image, so apps
can downscale and re-encode large photos *before* upload.

Public API surface is one method:

```js
ImageTune.tune(file, options) // → Promise<dataUrl>
```

Supported options (see `readme.md` for the table):
`width`, `height`, `quality` (1–100), `type` (`png`|`jpg`|`gif`), `mode` (`scale`|`crop`), `smoothingQuality`.

## Repository layout

- `index.js` — the entire library. UMD wrapper (AMD / CommonJS / global
  `window.ImageTune`) around two internal helpers and the exported object.
  - `loadImage(file)` — `FileReader` → `Image`, resolves with an `HTMLImageElement`.
  - `convertImage(image, options)` — draws to an offscreen `<canvas>` and
    returns `canvas.toDataURL(type, quality)`.
  - `ImageTune.tune(file, options)` — composes the two.
- `index.html` — minimal live example that wires a file input to `ImageTune.tune`.
- `readme.md` — user-facing docs and options table.
- `package.json` — `name: imagetune`, `version: 1.0.0`, `main: index.js`, no
  scripts, no dependencies, no dev dependencies.

There is no build step, no test suite, no linter, no CI, and no git tags or
published releases beyond whatever was manually pushed to npm as `1.0.0`.

## How the code is written (current style)

- ES5: `var`, function expressions, `new Promise(...)` manually — no `async`/`await`.
- UMD factory wrapper with an unused `($, _)` parameter list (leftover, not wired up).
- Browser-only: relies on `document`, `Image`, `FileReader`, `HTMLCanvasElement`.
- No type annotations, no JSDoc types.

When editing `index.js`, preserve the UMD wrapper and ES5 syntax unless the
user explicitly asks for a modernization — otherwise builds/consumers relying
on the global `ImageTune` will break.

## Common tasks

- **Try it locally:** open `index.html` directly in a browser, or serve the
  directory (`python3 -m http.server` / `npx serve .`) and pick an image.
- **Publish to npm:** currently manual — bump `package.json` version, `npm publish`.
  There is no automated release pipeline yet.
- **Run tests:** none exist. `npm test` prints an error and exits 1.

## Gotchas

- `convertImage` computes `widthRatio`/`heightRatio` as `image.width / width`
  (source over target), so the `>` comparison in `scale` mode chooses the
  *larger* shrink factor — i.e. it fits the image *inside* the target box
  while preserving aspect ratio. Don't "simplify" this without re-deriving it.
- `gif` is accepted as an input type but `canvas.toDataURL('image/gif', q)`
  silently falls back to PNG in every major browser — the option is effectively
  a no-op for output. Worth flagging if touching the types table.
- Errors in `convertImage` call `reject(...)` but execution continues after
  the `reject` (no `return`), so the rest of the function still runs. Preserve
  this only if intentionally matching current behavior; otherwise add `return`.
- `loadImage` has no `reader.onerror` / `image.onerror` handler — malformed
  files hang the returned promise forever.
- `ImageTune.tune` swallows errors from `loadImage` and `convertImage` (no
  `.catch`, no `reject` wired through). The outer promise never rejects.

## Branch conventions

Feature work happens on `claude/...` branches. `master` is the default branch.
Do not push to `master` without explicit instruction.
