# Usage

This guide documents the commands that exist in the current workspace. The preferred path is the one-shot CLI; the package-by-package commands are useful when debugging intermediate JSON.

## Environment

Required for fixture and preview work:

- Node.js 22 or newer
- npm workspace dependencies installed

Optional tools:

- `rsvg-convert` or ImageMagick `convert` for PNG previews. SVG output works without them.
- `git` and `gh` for extracting real repository/PR data.
- OpenRCT2 for manual in-game builds and screenshots.

OpenRCT2 is not installed in this environment. Use the preview renderer as the local visual check.

## Validate The Fixtures

From the repository root:

```sh
npm run validate
```

This validates:

- `fixtures/sample.work-model.json` against `schemas/work-model.schema.json`
- `fixtures/sample.park-plan.json` against `schemas/park-plan.schema.json`

The fixture and schema files are specs. Do not edit them for normal usage or tuning.

## Render The Sample Fixture

The shortest path to a visual result is to render the committed park plan fixture:

```sh
mkdir -p build
npm --workspace @rctai/preview run render -- \
  "$PWD/fixtures/sample.park-plan.json" \
  "$PWD/build/sample-preview.svg" \
  "$PWD/build/sample-preview.png"
```

If PNG conversion fails because `rsvg-convert` or ImageMagick is unavailable, generate only SVG:

```sh
npm --workspace @rctai/preview run render -- \
  "$PWD/fixtures/sample.park-plan.json" \
  "$PWD/build/sample-preview.svg"
```

## Render A Repository

Use the integrated CLI for a real repository or this repository:

```sh
mkdir -p build
npm --workspace @rctai/cli run render -- \
  render "$PWD" main \
  --out "$PWD/build/rctai.park-plan.json" \
  --png "$PWD/build/rctai-preview.png"
```

For a different repository, replace `"$PWD"` and `main`:

```sh
npm --workspace @rctai/cli run render -- \
  render /path/to/repo main \
  --out "$PWD/build/repo.park-plan.json" \
  --png "$PWD/build/repo-preview.png"
```

For deterministic test output, pass a fixed generated timestamp:

```sh
npm --workspace @rctai/cli run render -- \
  render "$PWD" main \
  --out "$PWD/build/rctai.park-plan.json" \
  --png "$PWD/build/rctai-preview.png" \
  --generated-at 2026-06-16T12:00:00Z
```

## Run The Fixture Pipeline

Use this when you want to exercise classification, layout, track generation, and preview rendering from the sample work model:

```sh
mkdir -p build
npm --workspace @rctai/classifier run classify -- fixtures/sample.work-model.json --out "$PWD/build/sample.rides.json"
npm --workspace @rctai/layout run layout -- "$PWD/build/sample.rides.json" --work-model fixtures/sample.work-model.json --out "$PWD/build/sample.park-plan.json"
npm --workspace @rctai/trackgen run trackgen -- "$PWD/build/sample.park-plan.json" "$PWD/build/sample.park-plan.tracked.json" --metadata "$PWD/build/sample.trackgen-meta.json"
npm --workspace @rctai/preview run render -- "$PWD/build/sample.park-plan.tracked.json" "$PWD/build/sample-preview.svg" "$PWD/build/sample-preview.png"
```

The `trackgen` metadata file is useful when checking which track features were emitted or skipped.

## Extract A Real Repository

For a real repository with PR metadata available through GitHub CLI:

```sh
mkdir -p build
npm --workspace @rctai/extractor run extract -- /path/to/repo main --out "$PWD/build/repo.work-model.json"
npm --workspace @rctai/classifier run classify -- "$PWD/build/repo.work-model.json" --out "$PWD/build/repo.rides.json"
npm --workspace @rctai/layout run layout -- "$PWD/build/repo.rides.json" --work-model "$PWD/build/repo.work-model.json" --out "$PWD/build/repo.park-plan.json"
npm --workspace @rctai/trackgen run trackgen -- "$PWD/build/repo.park-plan.json" "$PWD/build/repo.park-plan.tracked.json" --metadata "$PWD/build/repo.trackgen-meta.json"
npm --workspace @rctai/preview run render -- "$PWD/build/repo.park-plan.tracked.json" "$PWD/build/repo-preview.svg" "$PWD/build/repo-preview.png"
```

Extractor notes:

- The first positional argument is the repository path.
- The second positional argument is the branch.
- Session linking is enabled by default and reads Claude session data from the configured session root.
- Use `--no-sessions` if you only want git and GitHub PR data.
- Use `--sessions-root <dir>` to point at a different session directory.

## Builder Plugin

The builder plugin is the path from `park-plan.json` to a real OpenRCT2 park, but it requires OpenRCT2 and a manual in-game run.

Useful local checks that do not require OpenRCT2:

```sh
npm --workspace @rctai/rctai-builder run typecheck
npm --workspace @rctai/rctai-builder run offline -- --plan fixtures/sample.park-plan.json
```

The offline command validates the plan and queues builder actions against a fake adapter. It does not create a `.park` file.

When the plugin is loaded in OpenRCT2, it listens on `127.0.0.1:6427` by default and exposes:

```sh
curl http://127.0.0.1:6427/health
curl -X POST -H 'Content-Type: application/json' --data-binary @build/repo.park-plan.tracked.json http://127.0.0.1:6427/build
curl 'http://127.0.0.1:6427/save?name=rctai'
```

After a real `.park` file exists, the screenshot helper can call the OpenRCT2 CLI:

```sh
scripts/screenshot.sh build/rctai.park --output build/rctai.png --size 1600x1200 --zoom 1
```

Set `OPENRCT2_BIN` or pass `--openrct2 /path/to/openrct2` if the binary is not on `PATH`.
