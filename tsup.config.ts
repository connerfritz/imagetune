import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2022',
  },
  {
    entry: { 'index.global': 'src/index.ts' },
    format: ['iife'],
    globalName: '__imagetune__',
    minify: true,
    sourcemap: true,
    target: 'es2020',
    outExtension: () => ({ js: '.js' }),
    // Unwrap the IIFE namespace so `window.ImageTune.tune(...)` works the
    // way it did in v1 even though the source uses ES modules.
    footer: {
      // Guard for non-browser execution (e.g. an SSR pre-render that
      // happens to evaluate the IIFE bundle). Bare `window` would throw.
      js: 'if (typeof window !== "undefined") window.ImageTune = __imagetune__.ImageTune;',
    },
  },
]);
