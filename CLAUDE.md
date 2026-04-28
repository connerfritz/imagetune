# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**ImageTune** is a tiny, zero-dependency browser library for client-side
image resizing, cropping, and format conversion. It takes a `Blob`
(typically a `File` from `<input type="file">`) and returns an encoded
`Blob`, so apps can downscale and re-encode large photos *before* upload.

Public API:

```ts
tune(file, options)         // → Promise<Blob>
tuneToDataURL(file, options) // → Promise<string>  (data: URL)
```

Options: `width`, `height`, `quality` (1–100), `type`
(`jpeg`/`jpg`/`png`/`webp`), `mode` (`scale`/`crop`),
`smoothingQuality`, `signal` (`AbortSignal`).

## Repository layout

- `src/` — TypeScript source.
  - `index.ts` — public API: `tune`, `tuneToDataURL`, default `ImageTune` object.
  - `load-image.ts` — `createImageBitmap` decode, with `FileReader` + `<img>` fallback.
  - `render.ts` — `OffscreenCanvas`/`HTMLCanvasElement` rendering pipeline.
  - `dimensions.ts` — pure scale/crop math, exhaustively unit-tested.
  - `types.ts` — shared types.
- `test/` — Vitest specs (happy-dom).
- `examples/index.html` — vanilla browser demo using the IIFE build.
- `dist/` — generated; do not edit. ESM (`index.js`), CJS (`index.cjs`),
  IIFE (`index.global.js`), and `.d.ts`.
- `.github/workflows/` — `ci.yml`, `release.yml`, `lint-pr-title.yml`.
- `.releaserc.json` — semantic-release config.
- `tsup.config.ts`, `tsconfig.json`, `biome.json`, `vitest.config.ts` — tooling.

## Toolchain

- Node ≥ 20, pnpm 10. Lockfile (`pnpm-lock.yaml`) is committed.
- TypeScript strict, target ES2022, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`.
- Build: **tsup** (one config, three outputs).
- Lint + format: **Biome** (single tool — no ESLint, no Prettier).
- Test: **Vitest** with `happy-dom`. Canvas APIs are stubbed in `tune.test.ts`
  because happy-dom doesn't render pixels; pure logic lives in `dimensions.ts`
  and is tested without stubs.
- Package quality gates in CI: `publint` + `@arethetypeswrong/cli`.

## Common tasks

- **Develop:** `pnpm dev` (tsup watch) → open `examples/index.html` in a
  browser (or `npx serve .`).
- **Validate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify-package`.
- **Release:** automated. Merge a Conventional Commit to `main`;
  semantic-release publishes the npm version with provenance, creates the
  GitHub Release, regenerates `CHANGELOG.md`, and tags the commit.
  Manual `npm publish` is no longer the workflow.

## Conventions

- **Conventional Commits required.** PR titles are linted by
  `lint-pr-title.yml`; squash-merging makes the title the commit. `fix:`
  → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` footer → major.
  A non-conforming squash means *no release at all* — that's why the
  PR-title check is a required check.
- Feature work happens on feature branches. `main` is the default
  branch and is protected — releases happen on push there.
- Don't add runtime dependencies. The point of this package is to be a
  thin canvas wrapper.
- Prefer editing existing files over adding new ones. The whole library
  is ~150 lines of source; resist the urge to over-modularize.

## Gotchas

- `gif` output was removed in v2. `canvas.toBlob('image/gif')` silently
  falls back to PNG in every major browser, so v1 never actually emitted
  GIFs. Don't add it back without `OffscreenCanvas.convertToBlob` actually
  supporting it.
- `avif` output is also unsupported and absent from the `type` enum.
  `OffscreenCanvas.convertToBlob({ type: 'image/avif' })` rejects in
  every production browser as of early 2026 ("The encoding operation
  failed"). AVIF *decoding* is universal, so `tune()` reads AVIF input
  fine — just can't emit it. Don't add it to `OutputFormat` without
  re-checking platform support.
- `tune()` returns a `Blob` in v2, not a data URL. The data-URL behavior
  is `tuneToDataURL()`. Updating the README/example without also updating
  this is the most common drift.
- The IIFE build re-assigns `window.ImageTune` to `.default` so
  `ImageTune.tune(...)` works the way it did in v1 even though the source
  uses ES modules. Don't strip the `footer.js` line in `tsup.config.ts`.
- `loadImage` `.close()`s the `ImageBitmap` in `tune()`'s `finally{}`.
  If you add a new code path that bypasses `tune()` and gets a bitmap,
  make sure it closes it too — leaking bitmaps starves the GPU on mobile.
- The repo's default branch is `main` (not `master`). All workflow
  triggers and `.releaserc.json:branches` target `main`.
