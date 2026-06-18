# RCTAI — Turn a repo into a RollerCoaster Tycoon park

Visualise the work on a git repository as a **RollerCoaster Tycoon (1999)**-style park.

- **park = repo**
- **ride = pull request**
- A PR's ride *type* and *thrill* are chosen from how the PR "felt": its **size**, how **adventurous** it was, and how **risky** it was.

This document is the implementation plan. It is written so that independent agents can pick up
numbered tasks (T0–T13) and work in parallel against fixed contracts.

---

## 1. How the pieces fit

```
  git branch ───┐
                ├─▶ [T1 extractor] ─▶ work-model.json ──▶ [T4 classifier] ─┐
  gh PRs ───────┘                          (schema)                        │
                                                                           ├─▶ [T5 layout]
  ~/.claude/*.jsonl ─▶ [T2 session-link] ──▶ (merged into work-model)      │     +
                                                                           └─▶ [T6 track-gen]
                                                                                   │
                                                                                   ▼
                                                                            park-plan.json
                                                                              (schema)
                                                                           ┌───────┴────────┐
                                                                           ▼                ▼
                                                              [T7 preview renderer]   [T8 builder plugin]
                                                              isometric SVG/PNG        OpenRCT2 plugin,
                                                              (verify here, no game)   TCP listener + executeAction
                                                                                              │
                                                                                       [T9 screenshot CLI]
                                                                                       openrct2 headless → PNG
```

Two render targets share **one contract** (`park-plan.json`):
1. **Preview renderer (T7)** — pure isometric SVG, runs anywhere, used to verify output *without* the game.
2. **Builder plugin (T8)** — builds the real park inside OpenRCT2.

### Important finding about `OpenRCT2.API`
`OpenRCT2.API/` is the **.NET + RethinkDB backend for the openrct2.org website** (controllers: `build`,
`news`, `github/push`, `servers`, `user`, `objects`, `localisation`). It does **not** drive a running
simulator and cannot place rides. The real "REST in front of the game" is achieved by the **builder
plugin (T8)**, which uses the scripting API's TCP `Listener`/`Socket`
(`OpenRCT2/distribution/scripting/openrct2.d.ts:5361`) to expose a tiny HTTP/JSON server in-process.
Treat `OpenRCT2.API` as reference only; do not depend on it for building parks.

---

## 2. Contracts (already scaffolded — do not break)

| File | Purpose |
|------|---------|
| `schemas/work-model.schema.json` | Output of extraction (T1/T2). park=repo, ride=PR. |
| `schemas/park-plan.schema.json`  | Buildable park; input to T7 & T8. |
| `fixtures/sample.work-model.json`| 5 hand-authored PRs (boring → risky → showpiece). |
| `fixtures/sample.park-plan.json` | Golden classified+laid-out output for the sample. |

Every tool MUST validate its I/O against these schemas (use `ajv` in node or `jsonschema` in python).
Versioning rule: bump `schemaVersion` only for **breaking** changes (removed/renamed/retyped/newly-required
fields). **Additive optional** fields do not bump the version. Either way, update both fixtures and note
it here. Spec owners make these changes; agents propose via SPEC-CHANGE notes.

**Changelog:**
- *2026-06-16* (additive, no version bump): park-plan gains optional `park.requiredObjects[]` and
  `ride.build.{tower,transport,flat}` (tower height/mode, transport loop length, flat-ride size hints);
  clarified `ride.rideObject` resolution + base-scenario object loading (see §5). Resolves the two
  SPEC-CHANGE proposals from the Wave-A orchestrator.

---

## 3. Classification design (the creative core) — owned by T4

Compute three normalised axes in `[0,1]` per PR, then pick an archetype from the matrix.

### 3.1 Axes
```
churn      = additions + deletions
size       = clamp( 0.60*log2(1+churn)/12
                  + 0.25*log2(1+filesChanged)/7
                  + 0.15*log2(1+commits)/5 , 0, 1)        # churn~4000 -> ~1.0

adventure  = sum_i (categoryWeight[i] * categories[i])    # content-driven
             + 0.15*(newFiles/max(filesChanged,1))        # net-new work
             + 0.10*languageBreadthBonus                  # touched many langs
   categoryWeight = {feature:1.0, perf:0.8, refactor:0.6, test:0.3,
                     build:0.2, config:0.15, chore:0.10, docs:0.05}

risk       = clamp(
               0.30*codeTouchedNoTests
             + 0.25*netDeletion
             + 0.20*hotFilesPresent
             + 0.20*(size>0.6 && reviewCount<1)
             + 0.20*hasRevert
             + 0.15*forcePush
             + 0.20*sessionErrorPressure , 0, 1)
   sessionErrorPressure = clamp((errors+retries) / max(userTurns,1), 0, 1)
```
All weights live in one `weights.ts/.py` constants file so they are tunable in one place.

### 3.2 Two-stage selection over the full catalog
**The complete mapping for all 91 rides × complexity lives in `docs/ride-mapping.md`.** Summary:
Stage 1 picks a **family** from the axes (the matrix below); Stage 2 picks the **specific ride** within
that family as the nearest `axisProfile` in `data/ride-profiles.json`. This scales the matrix intuition
to every ride and was validated on the fixtures (caching→`looping_rc`, rewrite→`giga_rc`, docs→stall).

| condition | family | example rides |
|-----------|--------|---------------|
| docs/chore ≥ 0.8 | `stall` | `information_kiosk`, food/drink stall |
| adv<0.4, size≥0.55 | `transport` | `miniature_railway`, `monorail`, `chairlift` — *big but boring* |
| adv<0.4, size<0.55 | `gentle` | `merry_go_round`, `spiral_slide`, `maze` |
| adv≥0.4, size<0.4, risk≥0.6 | `thrill` | `launched_freefall` ("Whoa Belly"), `roto_drop`, `top_spin` — *small but risky* |
| adv≥0.4, size<0.4 | `coaster:compact` | `steel_wild_mouse`, `steeplechase`, `alpine_rc` |
| (config+build) heavy, mid size | `water` | `log_flume`, `river_rapids` |
| adv≥0.4, size<0.72 | `coaster:mid` | `corkscrew_rc`, `looping_rc`, `mine_train_rc` |
| adv≥0.4, size≥0.72 | `coaster:mega` | `giga_rc`, `hypercoaster`, `lsm_rc`, `inverted_rc` — *the showpiece* |

### 3.3 Derived ride parameters
- `footprint` scales with `size` (gentle ~3×3 → mega ~14×11).
- coaster `track` length ∝ size; loop/inversion count ∝ adventure; airtime/steep drops ∝ risk.
- `colours` seeded deterministically from PR author (stable per-person palette).
- `intensity` = synthetic excitement/intensity/nausea derived from the axes (for sign text + preview).
- `sign` = `PR #<n> - <short title> (<author>)`, with `RISKY`/`SHOWPIECE` tags at thresholds.

---

## 4. Track generation — owned by T6
**Full build-out rules are in `docs/ride-mapping.md` §3** (station/lift/drop/inversion/helix/banking
budgets as functions of size·adventure·risk, gated by each ride's supported `trackGroups`). Key idea:
a feature is only emitted if the chosen ride supports it — so wooden coasters never loop, mine rides
never invert, transport rides stay flat.
```
beginStation → station×Ns → endStation → liftHill×Hl → firstDrop
  → [feature-block]×F (inversions ∝ adventure · helices ∝ size · airtime ∝ risk)
  → brakes → return turns → beginStation
```
`TrackElemType` numeric ids are in `OpenRCT2/src/openrct2/ride/ted/TrackElemType.h` (e.g.
`leftVerticalLoop=40`), or query `context.getAllTrackSegments()` at runtime. Emit `track[]` in
`park-plan.json`; non-track families (transport length, tower height, flat rides) emit `track: null`
with size/height hints. Deliver a hand-verified template per family first; procedural later.

---

## 5. Builder plugin protocol — owned by T8
OpenRCT2 JS plugin (`plugin/rctai-builder/`), `typecheck` against `openrct2.d.ts`.
- Opens `network.createListener()` on a configurable port; speaks minimal HTTP/1.1.
- Routes: `GET /health`, `POST /build` (body = park-plan.json), `POST /clear`, `GET /save?name=`.
- Also supports `--plan <file>` offline mode (read plan from disk, build, save).
- **Phase 0 — ensure objects (do this BEFORE any `ridecreate`).** The base scenario is NOT assumed to
  contain the ride objects; load them at runtime. For each distinct ride object needed run
  `ensureRideObject(rideType, preferredId)`:
    1. If a currently-loaded ride object already has this `rideType`, use its index.
    2. Else if `preferredId` (ride.rideObject) is installed (`objectManager.getInstalledObject`),
       `objectManager.load(preferredId)` and use it.
    3. Else scan `objectManager.installedObjects` for any ride object matching `rideType`, `load()` it.
    4. Else **skip** that ride, log a warning, and add it to the build report's `skipped[]` — never throw.
  First `objectManager.load(park.requiredObjects)` in bulk, then resolve per-ride as above. This is the
  fix for "scenario lacks fixture ride objects" — PR-102/103/104 build as long as *some* matching object
  is installed on the machine.
- Build order per ride: resolve object (Phase 0) → `ridecreate` → place track (`track[]`) **or** apply
  `build.tower`/`build.transport`/`build.flat` **or** flat ride at `position`/`rotation` → place
  entrance+exit → `ridesetname` (sign) → `ridesetappearance` (colours) → `ridesetstatus open`.
  Then place `paths`, then `scenery`.
- `executeAction` is validated/async → run as a **queued state machine** driven by an `interval.tick`
  hook (one action per tick, advance on success, log+skip on failure). Never assume synchronous success.
- `POST /build` returns a **build report**: `{ built: [...ids], skipped: [{id, reason}], warnings }`.
- **Base-scenario contract:** an `OpenScenarios/*.park` template (or blank map) only needs to provide
  terrain + a park entrance. Ride/scenery objects are guaranteed by Phase 0, not by the scenario's
  pre-selected object list.

---

## 6. Preview renderer — owned by T7
Pure function `park-plan.json → SVG` (then `convert`/`rsvg-convert` → PNG for inline viewing).
- 2:1 isometric grid; draw the park rectangle, footpaths, and one stylised tile-glyph per archetype
  (slide = helix; coaster = looping line; transport = straight rail; drop = tower; stall = hut).
- Colour each ride by its author palette; size the glyph by `footprint`; badge `RISKY`/`SHOWPIECE`.
- Tooltip/legend lists PR title + axes. This is the artifact we use to **verify** classification/layout
  without OpenRCT2. Must run with only node (no game, no native deps beyond an SVG→PNG step).

---

## 7. Repo layout (target)
```
rctai/
  PLAN.md                      <- this file
  docs/ride-mapping.md         <- full ride x complexity mapping + build-out rules (done)
  schemas/                     <- contracts (done)
  fixtures/                    <- sample I/O (done)
  data/                        <- ride-catalog.json + ride-profiles.json (done, engine-derived)
  scripts/                     <- extract-ride-catalog.py, derive-ride-profiles.py (done)
  packages/
    extractor/                 T1, T2     (node+gh, or python)
    classifier/                T4         (pure)
    layout/                    T5         (pure)
    trackgen/                  T6         (pure)
    preview/                   T7         (node -> svg/png)
    cli/                       T3         (orchestrator: `rctai render <repo> <branch>`)
  plugin/rctai-builder/        T8         (OpenRCT2 JS plugin + d.ts typecheck)
  scripts/screenshot.sh        T9         (openrct2 headless wrapper)
  docs/                        T10..      (usage, tuning, gallery)
```
Pick **one** language for packages/*. Recommendation: **TypeScript (node)** so the classifier/layout/
trackgen code can be shared with the plugin. `gh` + `git` are available; `ajv` for schema validation.

---

## 8. Task graph

Legend: **[blocked-by]**. Tasks with no shared files can run in parallel.

- **T0 — Project scaffolding & schema validation harness.** [none]
  Set up the TS workspace, `ajv` validation, a `make validate` that checks both fixtures against schemas,
  and CI lint/typecheck. *Done when:* `npm run validate` passes on the committed fixtures.

- **T1 — Git/PR extractor.** [T0]
  Input: repo path + branch. Use `gh pr list/view --json` and `git log/--numstat` to emit `work-model.json`.
  Handle repos with no PRs via synthetic PRs from merge topology (`SYNTH-n`). Classify each file into a
  `category` and `language` by path/extension. *Done when:* running on a real repo produces schema-valid
  output and on `register` produces ≥1 PR.

- **T2 — Claude session linker.** [T1]
  Parse `~/.claude/projects/**/**.jsonl`; compute session metrics (duration, turns, toolCalls, edits,
  bash, errors, retries). Link a session to a PR by branch (cwd path slug), time window, and file overlap.
  Merge into `pr.session`. *Done when:* a known session attaches to the right PR; unlinked PRs keep `null`.

- **T3 — CLI orchestrator.** [T1,T4,T5,T7]
  `rctai render <repo> <branch> [--out park-plan.json] [--png preview.png] [--build host:port]`.
  Chains extractor→classifier→layout→trackgen→preview, optionally POSTs to the plugin. *Done when:*
  one command turns a repo into `park-plan.json` + `preview.png`.

- **T4 — Classifier.** [T0]
  Implement Section 3 + `docs/ride-mapping.md` (two-stage family→ride selection). Load
  `data/ride-profiles.json`; keep axis + selection weights in one tunable file. Port the reference
  Python in `scripts/derive-ride-profiles.py`/the `classify` prototype to TS. Input `work-model.json`
  → rides[] (rideType + axes + buildOut refs, no positions). *Done when:* on
  `fixtures/sample.work-model.json` selections are sensible (102→a looping/mega coaster, 104→a mega
  coaster, 103→a thrill/drop ride, 105→stall) and deterministic.

- **T5 — Layout.** [T4]
  Assign non-overlapping `position`s (shelf/bin-pack by merge order, bigger size = bigger cell), park
  `size`, `entrance`, and connecting `paths` (chronological spine). Output full `park-plan.json`.
  *Done when:* no ride bounding boxes overlap and every ride is path-connected to the entrance.

- **T6 — Track generator.** [T4]
  Implement the build-out budgets in `docs/ride-mapping.md` §3, reading each ride's `buildOut` support
  sets from `data/ride-profiles.json` and `TrackElemType` ids from `ted/TrackElemType.h`. Emit `track[]`
  for coaster/water families; size/height hints for transport/tower/flat. *Done when:* each coaster has
  a closed, station-rooted segment list whose length scales with `size`, inversions with `adventure`
  (and only uses inversions the ride supports), and drops steepen with `risk`.

- **T7 — Preview renderer.** [T0]
  Section 6. `park-plan.json → preview.svg/png`. *Done when:* `fixtures/sample.park-plan.json` renders a
  legible isometric map showing all 5 rides distinctly with author colours and RISKY/SHOWPIECE badges.

- **T8 — Builder plugin.** [T0]
  Section 5. Typecheck against `openrct2.d.ts`. *Done when:* `tsc --noEmit` passes; protocol parser has
  unit tests; offline `--plan fixtures/sample.park-plan.json` builds without thrown exceptions in-game
  (manual run by a human with OpenRCT2).

- **T9 — Screenshot/headless wrapper.** [T8]
  Wrap `openrct2 screenshot`/headless to turn a built/saved `.park` into a PNG. Document install.
  *Done when:* given a `.park`, produces a top-down PNG.

- **T10 — Docs & gallery.** [T3,T7]
  README quickstart, weight-tuning guide, and a gallery of preview PNGs for a few real repos.

- **T11 — Tuning pass on real data.** [T2,T3]
  Run on real `register` branches/sessions; sanity-check that boring PRs feel boring and scary PRs feel
  scary; adjust `weights.*`. *Done when:* a human agrees the mapping "feels right" on 3 real PRs.

- **T12 — (stretch) base-scenario loading.** [T8]
  Let the plugin start from an `OpenScenarios/*.park` template (terrain/landscaping) instead of a blank map.

- **T13 — (stretch) peeps & extras.** [T8]
  Contributors → named guests; merged-PR age → ride wear; failing CI → broken-down ride, etc.

### Suggested parallel waves
1. **Wave A:** T0 → then T1, T4, T7, T8 in parallel (all depend only on T0 + fixtures).
2. **Wave B:** T2 (after T1), T5 & T6 (after T4), T9 (after T8).
3. **Wave C:** T3 (integration), then T10/T11; T12/T13 stretch.

---

## 9. Verification matrix
| Stage | How verified in this environment |
|-------|----------------------------------|
| Schemas/fixtures | `python3 -c json.load` (done) + `ajv` in T0 |
| Extractor (T1/T2) | run on real repo + session; assert schema-valid |
| Classifier/Layout/Track | run on fixtures; assert golden archetypes & no overlaps |
| Preview (T7) | render `sample.park-plan.json` → PNG; eyeball |
| Plugin (T8) | `tsc --noEmit` + unit-test HTTP parser; in-game run by human |
| Screenshot (T9) | requires OpenRCT2 install (document; optional here) |

## 10. Open decisions / assumptions
- Language for `packages/*`: **TypeScript** recommended (shares code with plugin). Confirm.
- PR source when no GitHub remote: synthetic PRs from merge commits (assumed OK).
- Session→PR linking is best-effort; PRs may have `session: null`.
- "Whoa Belly" == `launched_freefall` (RCT1 name); confirm this matches your nostalgia.
