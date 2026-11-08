# foliate-js (vendored)

- Upstream: https://github.com/johnfactotum/foliate-js
- Commit: 78914aef4466eb960965702401634c2cb348e9b1
- License: MIT (see LICENSE)

## Local changes

- Removed files not used by this app: tests, demo reader, UI, rollup config,
  PDF/CBZ/FB2/OPDS/TTS/dictionary modules, and the bundled `vendor/pdfjs`
  (PDFs are rendered with `pdfjs-dist` directly).
- `view.js` `initTTS` throws (tts.js removed).
- `view.js` `makeBook`: the PDF, CBZ, FBZ and FB2 branches were removed so the
  build does not emit chunks for the deleted modules.

Only reach this code through `src/reader/foliate-reader.ts` and
`src/import/metadata.ts`, both of which load it with dynamic `import()`.
