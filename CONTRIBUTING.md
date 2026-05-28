# Contributing

Thanks for your interest in `human-feedback`!

## Development setup

```bash
git clone <repo>
cd human-feedback
npm install
npm test
```

## Architecture

The repo uses an `@include`-based build process to keep shared code DRY:

```
src/shared/       single source of truth
src/tools/<name>/ tool-specific code
build/build.js    resolves @include directives
build/bundle.js   bundles bin/cli.js + deps into bin/cli.bundled.js
lib/templates/    built output (committed)
lib/compiler.js   reads lib/templates/ and produces compiled HTML
bin/cli.js        CLI source entrypoint (dev clones)
bin/cli.bundled.js  pre-bundled CLI (shipped to end users — committed)
```

When you edit anything in `src/`, run `npm run build` to regenerate the templates.
When you edit `bin/cli.js`, run `npm run build:bundle` to regenerate `bin/cli.bundled.js`.
`npm run build:all` does both. Tests run `build:all` automatically.

## Bundling the CLI

End users install via `curl | bash`, which clones the repo and symlinks
the **bundled** CLI (`bin/cli.bundled.js`) into their PATH. No `npm install`
runs on their machine, so the bundle must be committed up-to-date.

```bash
npm run build:bundle      # just the CLI bundle
npm run build:all         # templates + CLI bundle
```

The bundler (`build/bundle.js`) uses esbuild's JS API and explicitly resolves
`commander` and `picocolors` against this project's `node_modules` to bypass
any ancestor Yarn PnP manifest (e.g. a stray `~/.pnp.cjs`) that would
otherwise interfere with module resolution.

Always commit both `bin/cli.js` (source) and `bin/cli.bundled.js` (built)
in the same commit. `prepack` runs `build:all`, so npm/pack flows stay in sync.

## `@include` syntax

Inside JS files:
```js
/* @include shared/clipboard.js */
```

Inside HTML files:
```html
<!-- @include shared/preview-dialog.html -->
```

Paths are resolved relative to `src/`. Includes can be nested.

## Adding a shared module

1. Create the file in `src/shared/`
2. `@include` it from any tool that needs it
3. Run `npm run build`
4. Commit the source + the rebuilt templates

## Adding a new tool

1. Create `src/tools/<name>/` with an HTML template (or JS template for scripts)
2. Use `@include` to pull in shared modules where useful
3. Add an entry to the `targets` array in `build/build.js`
4. Add a `case` in `lib/compiler.js`'s `compile()` switch
5. Add file-extension detection in `detectTool()` (also in `lib/compiler.js`)
6. Update the README

## Tests

```bash
npm test
```

The test suite uses JSDOM to verify form rendering, checkbox toggling, payload generation, and the preview dialog flow. Add new tests in `test/run.js`.

## Style

- No build tools beyond a hand-rolled `build/build.js`.
- No frameworks in the templates — vanilla JS + CSS for portability.
- Templates are self-contained HTML (one file, no external assets beyond Google Fonts).

## Pull requests

- Run `npm test` before opening a PR
- Commit both source changes (`src/`) and rebuilt templates (`lib/templates/`)
- Add a CHANGELOG entry
