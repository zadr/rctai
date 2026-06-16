# Weight Tuning

RCTAI classification is deterministic. A PR becomes axes, axes choose a ride family, and then the nearest ride profile inside that family chooses the specific ride. Tune in small steps and verify against the sample fixture before trying real repositories.

## Tuning Surfaces

Primary classifier weights live in `packages/classifier/src/weights.ts`:

- `axis.size`: log-scaled churn, files changed, and commits.
- `axis.adventure`: category weights, new-file ratio, and language breadth bonus.
- `axis.risk`: code-without-tests, net deletion, hot files, review pressure, reverts, force pushes, and session error pressure.
- `selection.distance`: nearest-profile weights for size, adventure, and risk.
- `selection.thresholds`: family boundaries such as stall, boring transport, compact coaster, mega coaster, and risky thrill.
- `display` and `intensity`: sign tags and preview intensity numbers.
- `colours`: deterministic author palettes.

Ride profile data lives in `data/ride-profiles.json` and is generated from engine-derived catalog data. Treat `data/*.json`, `schemas/**`, `fixtures/**`, `PLAN.md`, and `docs/ride-mapping.md` as specs unless you are intentionally making a coordinated spec change.

## Safe Tuning Loop

1. Start from the sample fixture:

```sh
mkdir -p build
npm --workspace @rctai/classifier run classify -- fixtures/sample.work-model.json --out "$PWD/build/sample.rides.json"
npm --workspace @rctai/layout run layout -- "$PWD/build/sample.rides.json" --work-model fixtures/sample.work-model.json --out "$PWD/build/sample.park-plan.json"
npm --workspace @rctai/trackgen run trackgen -- "$PWD/build/sample.park-plan.json" "$PWD/build/sample.park-plan.tracked.json" --metadata "$PWD/build/sample.trackgen-meta.json"
npm --workspace @rctai/preview run render -- "$PWD/build/sample.park-plan.tracked.json" "$PWD/build/sample-preview.svg" "$PWD/build/sample-preview.png"
```

2. Change one group of weights at a time.

3. Re-run the fixture pipeline and inspect:

- Axis values on each classified ride.
- Family and `rideType` selections.
- `RISKY` and `SHOWPIECE` sign tags.
- Preview footprint, labels, and visual distinction.
- Trackgen metadata for skipped unsupported features.

4. Verify:

```sh
npm run validate
npm run lint
```

Use `npm run typecheck` as well when changing TypeScript.

For a real-repo tuning pass, use the integrated CLI first:

```sh
npm --workspace @rctai/cli run render -- \
  render /path/to/repo main \
  --out "$PWD/build/repo.park-plan.json" \
  --png "$PWD/build/repo-preview.png" \
  --generated-at 2026-06-16T12:00:00Z
```

## Practical Recipes

Make routine cleanup less prominent:

- Lower `axis.size.churn` or raise `axis.size.churnLogDenominator`.
- Lower `axis.adventure.categories.chore` and `docs`.
- Raise `selection.thresholds.bigBoringSize` if large low-adventure changes become transport too often.

Make feature work more coaster-like:

- Raise `axis.adventure.categories.feature`, `perf`, or `refactor`.
- Lower `selection.thresholds.boringAdventure`.
- Lower `selection.thresholds.megaSize` if large features are not becoming showpieces soon enough.

Make risky hotfixes read as scary:

- Raise `axis.risk.hotFilesPresent`, `codeTouchedNoTests`, or `sessionErrorPressure`.
- Lower `selection.thresholds.riskyThrill`.
- Lower `selection.thresholds.towerThrillRisk` if the highest-risk small changes should become tower/drop rides.

Reduce over-triggered risk:

- Lower `axis.risk.bigDiffNoReview` if missing review data is noisy.
- Lower `axis.risk.netDeletion` if legitimate cleanup looks dangerous.
- Raise `selection.thresholds.riskyThrill`.

Tune ride identity after family selection:

- Adjust `selection.distance` to prefer profiles closer on adventure or risk.
- Regenerate ride profiles only when changing the profile derivation algorithm or engine-derived data. That is a broader spec-level change because `data/ride-profiles.json` is part of the shared contract.

## Spec-Change Boundaries

Raise a SPEC-CHANGE note before changing any of these:

- Schema shape or `schemaVersion`.
- Fixture meaning or expected classifications.
- `docs/ride-mapping.md` family/build-out rules.
- Generated ride catalog/profile JSON.
- Package command contracts that documentation or other tasks rely on.

Normal weight tuning inside `packages/classifier/src/weights.ts` does not require a schema change, but it should include before/after fixture output in the review notes.
