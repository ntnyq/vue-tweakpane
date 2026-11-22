# Repository Guidelines

## Project Structure & Module Organization

- `src/index.ts` defines the public API of `vue-tweakpane`, a Vue 3 library. `use-tweakpane.ts` owns pane creation and disposal, `use-tweak-binding.ts` synchronizes Vue state with Tweakpane controls, and `pane-lifecycle.ts` coordinates cleanup.
- `tests/` contains library and lint-rule tests. The custom Oxlint rule lives in `scripts/oxlint.ts`.
- `playground/` is a private Vite workspace package for manual testing. Its Vue demo lives in `playground/src/` and imports the library from source through a Vite alias. Package usage examples live in `README.md`.

## Build, Test & Development Commands

Run these commands from the repository root.

- `pnpm install` installs workspace dependencies. CI uses `pnpm install --frozen-lockfile`.
- `pnpm build` uses tsdown to emit JavaScript and type declarations to `dist/`. `pnpm dev` rebuilds the library on changes.
- `pnpm play:dev` starts the Vite demo. `pnpm play:build` builds it.
- `pnpm format` applies Oxfmt. `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` check formatting, Oxlint rules, and TypeScript types.
- `pnpm test` runs the Vitest suite once.

## Coding Style & Naming

Use strict TypeScript, two-space indentation, single quotes, trailing commas, and semicolon-free statements. Use kebab-case filenames and camelCase composables prefixed with `use`, as in `use-tweakpane.ts` and `useTweakpane`. Use PascalCase for types and Vue components, as in `TweakpaneOptions` and `App.vue`. Use `<script setup lang="ts">` for playground components. Husky runs nano-staged to lint and format staged files.

## Testing Guidelines

Put runtime tests in `tests/*.test.ts` and use happy-dom for tests that mount Vue or interact with pane controls. Cover binding changes in both directions and verify cleanup when panes are replaced or disposed. Put public TypeScript assertions in `tests/*.test-d.ts` and Vue template type assertions in `tests/*.test-d.vue`. `pnpm typecheck` checks both. To run a single runtime file, use `pnpm test tests/index.test.ts`.

## Commit & Pull Request Guidelines

Follow the history's short `type: summary` format, such as `chore: init commit`. Open pull requests against `main`. Describe the change and how you verified it, link any related issue, and include a screenshot or recording for visible playground changes. Run the formatting, lint, type, build, and test checks before requesting review.
