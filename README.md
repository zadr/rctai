# RCTAI

RCTAI turns git repository work into a RollerCoaster Tycoon-style park:

- park = repository
- ride = pull request
- ride type, size, intensity, and styling = derived from PR size, adventure, and risk

The stable contract between packages is `park-plan.json`. The preview renderer turns that plan into SVG/PNG without OpenRCT2, while the OpenRCT2 builder plugin is a manual in-game path for machines that have OpenRCT2 installed.

## Quickstart

Prerequisites:

- Node.js 22 or newer
- npm workspace dependencies installed
- Optional for PNG output: `rsvg-convert` or ImageMagick `convert`
- Optional for real repositories: `git` and `gh`
- Optional for in-game builds: OpenRCT2 installed locally

Verify the checked-in specs and code:

```sh
npm run validate
npm run lint
```

Render the current repository with the one-shot CLI:

```sh
mkdir -p build
npm --workspace @rctai/cli run render -- \
  render "$PWD" main \
  --out "$PWD/build/rctai.park-plan.json" \
  --png "$PWD/build/rctai-preview.png"
```

The CLI also writes an SVG companion next to the PNG. If PNG conversion tools are missing, run the package pipeline and render only SVG, or install `rsvg-convert`/ImageMagick.

Render the committed fixture plan directly with the in-environment preview renderer:

```sh
npm --workspace @rctai/preview run render -- \
  "$PWD/fixtures/sample.park-plan.json" \
  "$PWD/build/sample-preview.svg" \
  "$PWD/build/sample-preview.png"
```

A committed fixture preview is available in [guides/gallery.md](guides/gallery.md).

## Pipeline

The one-shot command chains extractor, classifier, layout, track generation, and preview:

```sh
npm --workspace @rctai/cli run render -- \
  render /path/to/repo main \
  --out "$PWD/build/repo.park-plan.json" \
  --png "$PWD/build/repo-preview.png"
```

Use the lower-level package commands when debugging an intermediate artifact:

```sh
mkdir -p build
npm --workspace @rctai/classifier run classify -- fixtures/sample.work-model.json --out "$PWD/build/sample.rides.json"
npm --workspace @rctai/layout run layout -- "$PWD/build/sample.rides.json" --work-model fixtures/sample.work-model.json --out "$PWD/build/sample.park-plan.json"
npm --workspace @rctai/trackgen run trackgen -- "$PWD/build/sample.park-plan.json" "$PWD/build/sample.park-plan.tracked.json" --metadata "$PWD/build/sample.trackgen-meta.json"
npm --workspace @rctai/preview run render -- "$PWD/build/sample.park-plan.tracked.json" "$PWD/build/sample-preview.svg" "$PWD/build/sample-preview.png"
```

See [guides/usage.md](guides/usage.md) for the full workflow and environment notes.

## OpenRCT2

OpenRCT2 is not installed in this environment. The reliable local verification path here is the preview renderer. The builder plugin can be typechecked and its Node offline harness can validate queued actions, but actual in-game building and screenshots require a local OpenRCT2 install and a manual plugin run.

## Docs

- [Usage guide](guides/usage.md)
- [Weight-tuning guide](guides/tuning.md)
- [Preview gallery](guides/gallery.md)
- [Ride mapping spec](docs/ride-mapping.md)
