## [2.0.0](https://github.com/connerfritz/imagetune/compare/v1.0.1...v2.0.0) (2026-04-28)

### ⚠ BREAKING CHANGES

* tune() now resolves with a Blob, not a data URL
string. Use URL.createObjectURL(blob) for previews, or call the new
tuneToDataURL() helper for v1-compatible behavior.
* gif and avif are removed from the OutputFormat union.
canvas.toBlob('image/gif') silently fell back to PNG in every browser
in v1 (so it never actually emitted GIFs), and no production browser
encodes AVIF via canvas as of early 2026. Pass 'png' or 'webp' instead.
* errors now reject the returned promise instead of
silently hanging. Callers without `.catch` on tune()/tuneToDataURL()
that relied on the v1 silent-failure behavior must now handle errors.
* the default export was removed in favor of named
exports. `var ImageTune = require('imagetune')` no longer works as a
namespace; use `const { tune, tuneToDataURL, ImageTune } = require(...)`
or `import { tune } from 'imagetune'`.
* the published distribution is now ESM + CJS via the
exports map. The bare `index.js` and `index.html` at the repo root no
longer exist. Bundlers should resolve correctly via the new exports
field; <script src> users should target the unpkg/jsdelivr URL.

### Bug Fixes

* switch commit-analyzer to conventionalcommits preset ([c80b4c5](https://github.com/connerfritz/imagetune/commit/c80b4c52a6433a477cbf2990df02b6f468990a86))

## [1.0.1](https://github.com/connerfritz/imagetune/compare/v1.0.0...v1.0.1) (2026-04-28)


### Bug Fixes

* **ci:** revert to NPM_TOKEN auth — semantic-release/npm doesn't support TP yet ([1fbd0e1](https://github.com/connerfritz/imagetune/commit/1fbd0e1e9ff082227083d3cf5e83e045d8c1a5ab))
* **ci:** use Node 24 in release job for npm 11+ Trusted Publishing ([8bb0edc](https://github.com/connerfritz/imagetune/commit/8bb0edc5dadce598b22b5cb84e5e4e86aeede94a))
