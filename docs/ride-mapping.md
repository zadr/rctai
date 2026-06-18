# Ride Mapping & Build-Out Spec

How a pull request becomes a ride. This is the design that **T4 (classifier)** and **T6 (track
generator)** implement. It is grounded in real engine data extracted from
`OpenRCT2/src/openrct2/ride/rtd/**`.

Generated data (regenerate with the scripts in `scripts/`):
- `data/ride-catalog.json` — every ride type (94, minus 3 alt paint variants → **91**): canonical
  `name` (e.g. `corkscrew_rc`), `category`, `trackGroups` (what it can build), `ratingsMultipliers`,
  `heights`, `hasInversions`, `hasGForces`.
- `data/ride-profiles.json` — for each ride: an **axis profile** placing it in the
  size×adventure×risk cube, plus a **buildOut** descriptor (which inversions / helices / steep drops /
  banking it supports).

## 1. The three axes (per PR)
Computed by the classifier from the WorkModel (see `PLAN.md` §3.1). All normalised to `[0,1]`.

| axis | meaning | main drivers |
|------|---------|--------------|
| **size** | how much work | additions+deletions, files, commits (log-scaled) |
| **adventure** | boring ↔ inventive | category mix (feature/perf high, config/docs low), new files, language breadth |
| **risk** | safe ↔ scary | no-tests-with-code, net deletion, hot files, reverts, force-push, big-diff-no-review, session errors/retries |

## 2. Two-stage selection
A pure nearest-ride search over all 91 rides misbehaves (a big calm feature matched *Boat Hire*).
So selection is **two-stage**: the axes choose a **family**, then the ride **axis-profiles** choose the
**specific ride** within that family (and drive build-out). This keeps the RCT-matrix intuition while
scaling to the whole catalog.

### Stage 1 — family (the matrix)
```
docs>=0.8 or chore>=0.8                      -> stall            (information_kiosk, food/drink stall…)
adventure < 0.40 (boring):
    size >= 0.55  -> transport               (miniature_railway, monorail, chairlift)  "big but boring"
    else          -> gentle                  (merry_go_round, spiral_slide, maze, car_ride)
adventure >= 0.40 (inventive):
    size < 0.40:
        risk >= 0.60 -> thrill               (launched_freefall "Whoa Belly", roto_drop, top_spin) "small but risky"
        else         -> coaster:compact      (wild_mouse, steeplechase, junior_rc, alpine_rc)
    (config+build) dominant & 0.4<=size<0.8 -> water  (log_flume, river_rapids)        data/IO heavy
    size < 0.72   -> coaster:mid             (corkscrew_rc, looping_rc, mine_train_rc)  proper feature
    else          -> coaster:mega            (giga_rc, hypercoaster, lsm_rc, inverted_rc) the showpiece
```
Coaster tiers are derived from each coaster's intrinsic **size affinity**:
`compact <0.50`, `mid 0.50–0.72`, `mega >0.72`.

### Stage 2 — specific ride
Within the family pool, pick the ride minimising weighted distance in axis-space:
```
d = 1.0*(size-Ŝ)^2 + 1.2*(adventure-Â)^2 + 1.2*(risk-Ȓ)^2
```
where `(Ŝ,Â,Ȓ)` is the ride's `axisProfile`. Author identity seeds a stable colour palette so the same
person's rides share livery.

### Validated examples (current weights; tune in T11)
| PR shape (size, adv, risk) | family | chosen ride |
|---|---|---|
| bump deps / lint (.18,.12,.10) | gentle | `maze` |
| caching feature (.74,.80,.34) | coaster:mega | `looping_rc` (10 inversion types) |
| risky hotfix (.22,.40,.88) | thrill | `swinging_ship` |
| settlement rewrite (.97,.86,.72) | coaster:mega | `giga_rc` |
| docs only (.20,.05,.05) | stall | `information_kiosk`/`cash_machine` |
| small clever spinner (.30,.75,.35) | coaster:compact | `alpine_rc` |
| big boring config (.85,.20,.25) | transport | `chairlift` |
| big data pipeline (.70,.55,.45) | water | `boat_hire` |

## 3. Build-out rules — how to *construct* the ride
The classifier emits the ride; **T6** turns axes + the ride's `buildOut` support sets into a concrete
layout. A feature is only used if the chosen ride supports it (`trackGroups`), so e.g. a wooden coaster
never gets a loop and a mine ride never inverts.

### 3.1 Coasters (`coaster:*`, `water`)
Track template:
```
beginStation → station×Ns → endStation
  → liftHill×Hl → firstDrop
  → [ feature-block ]×F        (interleaved per budgets below)
  → brakes / blockBrakes
  → return turns to close circuit → beginStation
```
Budgets (all clamp to what the ride supports):
| element | formula | steepness / variant scales with |
|---|---|---|
| station length `Ns` | `2 + round(3·size)` | — |
| lift-hill height `Hl` | `round(lerp(2,14,size))` segments | — |
| first drop | always | `risk<0.4`→`down25`, `0.4–0.7`→`down60`, `>0.7`→ vertical/`down90` if in `steepDrops` |
| **inversions** | `round(adventure · min(|supportedInversions|,4))` | pick in priority `verticalLoop → corkscrew → halfLoop → barrelRoll → diveLoop → zeroGRoll → quarterLoop` (intersected with the ride's `buildOut.inversions`) |
| **helices** | `round(2·size)` if `buildOut.helices` non-empty | space-fillers sized to footprint; banked if available |
| banked turns | `round(2 + 4·size)` | bank sharpness ∝ risk (`flatRollBanking`→`slopeRollBanking`) |
| airtime hills | `round(3·risk)` via `sBend`/`slope` | — |
| brakes | 1 mid `blockBrakes` + 1 `brakes` pre-station | brake speed ∝ (1−risk) |

More **adventurous** ⇒ front-load inversions; more **risky** ⇒ steeper drops + faster, fewer brakes;
bigger **size** ⇒ longer station, taller lift, more helices/turns (consumes more footprint).

### 3.2 Towers (`launched_freefall` "Whoa Belly", `roto_drop`, `reverse_freefall_rc`)
No circuit. Emitted as **`build.tower`** in `park-plan.json` (not `track`):
`build.tower.height = round(lerp(16,64, max(size,risk)))` (Z steps);
`build.tower.mode = "launched"` if `risk >= 0.6` else `"drop"`.
Footprint stays ~3×3 — the "small but risky" shape: tiny on the map, terrifying in the air.

### 3.3 Transport (`miniature_railway`, `monorail`, `chairlift`, `suspended_monorail`)
"Big but boring": a long, gently winding **flat** circuit. Emitted as **`build.transport`**:
`build.transport.loopLengthTiles ∝ size`, only `straight/curve/slope` groups, **never** inversions.
The bigger the PR, the longer the scenic loop.

### 3.4 Gentle & flat thrill (`merry_go_round`, `spiral_slide`, `maze`, `ferris_wheel`, `swinging_ship`…)
Single placed ride; footprint from catalog `heights`. For size-parameterised rides (e.g. `maze`) emit
**`build.flat.sizeTiles`** ∝ size axis; otherwise `build.flat` may be omitted (footprint is enough).
No track gen.

### 3.5 Stalls (`information_kiosk`, `food_stall`, `drink_stall`, `toilets`, `cash_machine`)
1×1 placement beside the path. Used for docs/chore PRs. The sign carries the PR title.

## 4. Footprint sizing (for layout T5)
| family | footprint w×h |
|---|---|
| stall | 1×1 |
| gentle / thrill-flat | 2×2 … 4×4 (by size) |
| tower | 3×3 |
| water | 6×5 … 10×7 |
| coaster:compact | 5×4 |
| coaster:mid | 8×6 |
| coaster:mega | 12×9 … 16×12 (by size) |
| transport | spans the park as a connecting loop |

## 4a. Object availability (plan side)
A `rideType` (e.g. `looping_rc`) is an engine type; the buildable thing is a **ride object** (a
`.parkobj`, e.g. `rct2.ride.scht1`). The classifier SHOULD set each ride's `rideObject` to a preferred
installed object id and the layout SHOULD set `park.requiredObjects` to the de-duplicated union of those
ids. These are advisory: the builder loads them at runtime and falls back by `rideType`
(see `PLAN.md §5`). Do **not** assume the base scenario already contains them.

## 5. Regenerating the data
```
python3 scripts/extract-ride-catalog.py     # -> data/ride-catalog.json   (from engine rtd headers)
python3 scripts/derive-ride-profiles.py      # -> data/ride-profiles.json  (axis profiles + buildOut)
```
Affinity base weights live at the top of `derive-ride-profiles.py` (`CAT_BASE`) and are the main
tuning surface alongside the classifier weights in T4.
