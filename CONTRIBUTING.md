# Contributing

Thanks for your interest in `agent-feedback`!

## Development setup

```bash
git clone <repo>
cd agent-feedback
npm install
npm test
```

## Architecture

The repo uses an `@include`-based build process to keep shared code DRY:

```
src/shared/       single source of truth
src/tools/<name>/ tool-specific code
build/build.js    resolves @include directives
lib/templates/    built output (committed)
lib/compiler.js   reads lib/templates/ and produces compiled HTML
bin/cli.js        CLI entry point
```

When you edit anything in `src/`, run `npm run build` to regenerate the templates. Tests run the build automatically.

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
