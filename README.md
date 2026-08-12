# Mansion Protocol

A browser FPS built with Three.js and TypeScript. Two modes share one engine:
a finished **shooting range**, and a **zombies survival mode** that is
currently under construction (see [Zombies mode](#zombies-mode) for exactly
what is built and what is not).

The shooting range is complete and playable: seven weapons across rifles, a
belt fed machine gun, a bolt action and three submachine guns, four firing
lanes, steel plates at 25 / 50 / 100 / 200 m, and a gunplay model built around
recoil patterns, weapon bloom and travelling projectiles rather than instant
hitscan.

The goal is *playable realism*: weapons behave the way their category suggests, but
every number is tuned for feel, not copied from ballistic tables.

## Modes

Launching the game shows a mode menu. `SHOOTING RANGE` is fully playable.
Losing pointer lock pauses whichever mode is loaded and offers resume or quit.

## Tech stack

| Concern    | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Language   | TypeScript (strict)                                        |
| Rendering  | Three.js                                                   |
| Build      | Vite                                                       |
| Tests      | Vitest                                                     |
| Lint       | ESLint + typescript-eslint (flat config)                   |
| Audio      | Web Audio API, procedurally synthesised                    |
| Physics    | None. Segment raycasting and simple integration            |
| UI         | Plain DOM + CSS                                            |

Runtime dependencies: `three`. That is the whole list.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Pick a mode from the menu to lock the pointer and start shooting.

### Commands

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Vite dev server with HMR                        |
| `npm run build`    | Type check, then production build into `dist/`  |
| `npm run preview`  | Serve the production build locally              |
| `npm test`         | Run the unit tests once                         |
| `npm run test:watch` | Tests in watch mode                           |
| `npm run lint`     | ESLint over the whole project                   |
| `npm run typecheck`| `tsc --noEmit`                                  |

## Controls

| Input   | Action                            |
| ------- | --------------------------------- |
| `WASD`  | Move                              |
| Mouse   | Look                              |
| `LMB`   | Fire                              |
| `RMB`   | Aim down sights (hold)            |
| `R`     | Reload                            |
| `B`     | Toggle fire mode (where available)|
| `1-4`   | M4A1 / AK-47 / M60 / L96A1        |
| `5-7`   | MP5 / MP7 / UMP45                 |
| `T`     | Reset targets and statistics      |
| `ESC`   | Pause (releases pointer lock)     |

## Architecture

Composition over inheritance, one responsibility per module, no globals. `App`
owns the shell and swaps modes; each mode is the only place that knows about
more than its own concern, owning the frame order for its own gameplay.

```
src/
  core/        App (shell: renderer, input, audio, loop, mode swapping),
               GameLoop, Input, constants,
               modes/ (GameMode contract, RangeMode)
  player/      Player (movement, collision, view bob), CameraRig (look, recoil, FOV)
  weapons/     WeaponDefinition (types), definitions/ (the four weapons),
               Weapon (state machine), WeaponSystem (loadout, ADS, feel),
               viewmodel/ (procedural models + first person animation)
  shooting/    Ballistics (projectile pool), SceneScanner (segment queries),
               RecoilSystem, SpreadModel, ShootingSystem (fire → impact)
  range/       ShootingRange (static geometry), Target, TargetField
  effects/     InstancedPool + decals, sparks, casings, tracers, smoke, EffectsSystem
  rendering/   RenderContext (two pass renderer), Environment (lighting), textures
  audio/       AudioSystem (procedural synthesis, sample-ready)
  stats/       SessionStats
  map/         Mansion (procedural three storey map), Barrier, NavGraph
  zombies/     Zombie, ZombieManager (pool + instanced crowd + AI)
  rounds/      RoundManager (authoritative round state)
  ui/          MainMenu, Hud, ScopeOverlay
  utils/       math, Random, three helpers
tests/         weapon, ballistics, feel, models, zombies
```

### The app shell

`App` owns the renderer, input, audio and the frame loop, and swaps whole
modes in and out. A mode owns its own world scene and tears it down on exit,
so modes never see each other. The first person weapon scene is shared and
lit once by the shell.

### Frame order

The order matters, and it is deliberate:

1. Read input, apply look to the camera rig.
2. Move the player and resolve collisions.
3. `WeaponSystem.updateAim` — ADS blend, recoil springs, spread recovery, FOV target.
4. Compose the camera transform.
5. `WeaponSystem.updateFiring` — weapon timers, shots, view model animation.

Steps 3-5 are split around step 4 so a round leaves along the exact aim of the
current frame while recoil and ADS still apply within the same frame.

6. Advance projectiles and resolve impacts.
7. Targets, effects, HUD, render.

### Rendering

The world and the first person weapon are drawn as two passes against a cleared
depth buffer, each with its own camera. The weapon can never clip into geometry,
and the weapon keeps a stable field of view while the world FOV changes for ADS.

## Weapon system

Weapons are **data**. A `WeaponDefinition` declares cadence, magazine, reload,
recoil, spread, ADS, projectile, movement penalties, view model layout and audio
character. `Weapon` is a shared state machine — ammo, cadence, fire mode, reload,
bolt cycle — with no rendering or input knowledge, which is what makes it testable.
Nothing is subclassed per weapon; the personality comes from configuration.

| Weapon | Modes      | RPM | Mag | Reload | Character                                               |
| ------ | ---------- | --- | --- | ------ | ------------------------------------------------------- |
| M4A1   | auto/semi  | 800 | 30  | 2.3 s  | Fast, controllable, mild climb, quick ADS               |
| AK-47  | auto/semi  | 600 | 30  | 2.7 s  | Heavy kick, wide horizontal walk, punishing long bursts |
| M60    | auto       | 550 | 100 | 6.0 s  | Slow to raise, slow to move, bloom grows fast           |
| L96A1  | semi       | 90  | 10  | 3.4 s  | Bolt action, 6x scope, precise, one shot at a time      |
| MP5    | auto/semi  | 800 | 30  | 2.6 s  | Flat and controllable, slow arcing 9 mm                 |
| MP7    | auto/semi  | 950 | 40  | 2.4 s  | Fastest cadence, lightest kick, wanders sideways        |
| UMP45  | auto/semi  | 600 | 25  | 2.9 s  | Slow thumping .45 that drops hard past 100 m            |

Each weapon carries the sight picture it is known for — an A2 carry handle
aperture, an AK notch on the barrel trunnion, a leaf notch with an eared blade,
an HK rotary drum, a flip up ghost ring, a hooded notch — built on a shared
sight line so ADS aligns itself from the model's own anchor.

### Recoil

Recoil is not random spread. Each shot produces two channels:

- a **transient kick** that springs up and recovers on its own, and
- a **permanent displacement** folded into the aim angles, which the player has to
  pull back down.

`recoveryFraction` sets the mix per weapon: the M4 recovers 85% of every kick, the
M60 only 70%, so it walks off target under sustained fire. The horizontal component
is mostly deterministic — two out-of-phase sines indexed by the shot number — so
the pattern is learnable, with a bounded random share (`randomness`) on top.
`climbPerShot` makes the kick grow through a burst up to `maxClimb`.

### Spread

Separate from recoil. A base cone opens by `perShot` on every round up to a ceiling
and closes at `recovery` while the trigger is released, scaled by ADS and by movement
speed. The crosshair gap is computed from the actual cone angle, so what you see is
what the weapon is doing.

### Ballistics

No rigid bodies and no per-bullet scene objects. Every round is a point in a fixed
pool integrated with gravity and quadratic drag (`dv/dt = -k·v²`), and collisions are
segment casts between the previous and the current position — continuous, so nothing
tunnels even at 900 m/s. Rounds are aimed at whatever the crosshair covers, so close
shots converge correctly despite the muzzle sitting off the eye line, and drop below
that point at longer range.

Measured behaviour of the shipped tuning:

| Weapon | 25 m         | 100 m          | 200 m           |
| ------ | ------------ | -------------- | --------------- |
| M4A1   | 29 ms, 0.5 cm| 121 ms, 7.0 cm | 250 ms, 29.3 cm |
| AK-47  | 38 ms, 0.7 cm| 150 ms, 10.8 cm| 321 ms, 46.9 cm |
| M60    | 33 ms, 0.5 cm| 125 ms, 7.6 cm | 263 ms, 31.7 cm |
| L96A1  | 29 ms, 0.4 cm| 117 ms, 6.3 cm | 233 ms, 26.0 cm |

Travel time is perceptible past 100 m, and the 200 m plates need a real hold over.

### ADS and the scope

Aiming interpolates the view model between a hip pose and a computed sighted pose,
narrows the camera FOV, lowers mouse sensitivity, tightens spread and scales recoil —
all per weapon. The sighted pose is derived from a `sight` anchor in the model rather
than hand-tuned offsets, so a new model aligns itself.

The L96 scope costs nothing extra to render: the camera FOV does the magnification
and a CSS overlay masks everything outside the ocular. The weapon is hidden once the
ADS blend passes the scope threshold. There is no second scene and no render target.

## Zombies mode

Under construction. This section states exactly what exists today so nothing
here is mistaken for a finished feature.

**Built and unit tested:**

- **Mansion map** (`map/Mansion.ts`) — procedural, three interior storeys plus
  a roof terrace, joined by ramped staircases. Ramps stand in for steps so no
  step-climbing logic is needed. Rooms are laid out for zombie play: movement
  loops, a couple of choke points and defendable corners.
- **Paid barriers** (`map/Barrier.ts`) — doors, double doors and debris piles
  with escalating costs from $750 to $2500. A closed barrier blocks bullets,
  movement *and* navigation; opening one animates and is permanent.
- **Navigation** (`map/NavGraph.ts`) — a waypoint graph rather than a grid, so
  three floors and stairs stay cheap. A doorway is a single gated edge, so a
  closed barrier genuinely removes the route instead of relying on collision.
  Pathfinding reuses preallocated scratch buffers.
- **Zombies** (`zombies/`) — a fixed pool with idle / chase / attack / hurt /
  dead states, target selection, melee on a cooldown, and a segment-intersect
  query for hit detection. The whole crowd renders as four `InstancedMesh`
  layers (torso, head, two arms), so hundreds of walkers cost four draw calls
  and nothing is created or destroyed while playing.
- **Rounds** (`rounds/RoundManager.ts`) — authoritative round state with the
  strict rule that a round is finished only once every zombie belonging to it
  has both spawned *and* died. Clearing the map is not enough while walkers are
  still queued. Budgets grow per round and per player, with a live cap.
- **Vertical movement** — `Player` now takes an optional `GroundSampler`, so it
  falls, lands and walks up ramps on multi storey maps. The range passes none
  and behaves exactly as before.

**Not built yet:** the mode that wires these together, co-op networking, the
Pack-a-Punch machine, the ten additional weapons, and the slot machine special
weapon with its pity and nuclear jackpot. The mode menu deliberately does not
offer Zombies until it is playable, rather than showing a dead button.

## Performance

Target is a stable 60 FPS on a modern desktop browser. Measured in the shipped build:
**~90 draw calls and ~6.6k triangles per frame**, and after ~200 rounds fired the
geometry, texture, shader-program and scene-graph counts are all unchanged.

What keeps it there:

- Every transient effect is a pooled `InstancedMesh` with a fixed capacity: bullet
  holes, sparks, brass, tracers and smoke each cost one draw call regardless of count,
  and recycle oldest-first instead of accumulating.
- Projectiles live in a fixed pool; a saturated pool reuses the oldest round.
- Repeated static geometry (lane dividers, posts, sign posts) is instanced.
- No allocations in the hot path: shared scratch `Vector3`/`Quaternion`/`Matrix4`
  temporaries, reused raycaster and result arrays, and a reused per-frame result
  object in `Weapon.update`.
- One shadow-casting light with a tight ortho frustum, rendered **once** rather than
  every frame (`shadowMap.autoUpdate = false`) since the world is static.
- The muzzle light lives in the scene permanently at zero intensity, so light counts
  never change and materials are never recompiled mid-game.
- `devicePixelRatio` capped at 2; cheap Lambert materials for the world, Phong only
  for weapons and plates; no post-processing.
- HUD values are cached and only written to the DOM when they actually change.

## Extending

### Adding a weapon

1. Drop a new file in `src/weapons/definitions/` exporting a `WeaponDefinition`.
2. Add it to `WEAPON_LOADOUT` in `src/weapons/definitions/index.ts` (slot order maps
   to the number keys) and to `WEAPONS_BY_ID`.
3. Add a builder in `src/weapons/viewmodel/WeaponModelFactory.ts` keyed by the new id.

No other file needs to change. Fire mode, bolt action and scope behaviour all follow
from the definition: give it a `boltCycleTime` and it becomes bolt action, give its
`ads` a `scope` and it gets the scope overlay.

### Replacing the placeholder models with GLB

The models are procedural on purpose — the game never blocks on assets, and there are
no third-party assets in this repository, so there is nothing to license. Everything
downstream depends only on the `WeaponModel` contract:

```ts
interface WeaponModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;        // bullets, flash, smoke
  ejectionPort: THREE.Object3D;  // brass
  sight: THREE.Object3D;         // aligned with screen centre when aiming
  bolt: THREE.Object3D | null;   // animated per shot / per bolt cycle
  magazine: THREE.Object3D | null;
}
```

To switch to real assets, load the file with `GLTFLoader` and return that same shape
from `createWeaponModel`, resolving the anchors from named nodes in the file (or
adding empties where the artist did not). If you add third-party assets, keep them
under a clearly compatible licence and document their provenance here.

### Replacing the placeholder audio

`AudioSystem` synthesises every sound (a filtered noise crack, a low body thump and a
tail) so the project has no audio dependencies. It already prefers real samples when
they exist: call `audio.loadSample('shot:m4a1', url)` — or any `SoundId` — and that
buffer is played instead of the synth. No other code changes.

## Testing

`npm test` covers the deterministic logic, which is where the bugs actually
live. For the range: 
cadence and frame-rate independence, magazine and reload, semi vs auto trigger
behaviour, fire mode switching, the bolt cycle, dry firing, equip timing, recoil
accumulation and recovery, pattern determinism under a seeded RNG, per-weapon recoil
ordering, spread bloom and ceilings, projectile time of flight and drop, pool
recycling, accuracy statistics and definition sanity. Three.js rendering itself is
not unit tested; it is verified by running the game.

For the zombies systems: navigation over open and gated graphs, route choice,
barrier gating in both directions, zombie damage and death, and the full round
lifecycle — spawn gating, the live cap, the "not finished while walkers are
queued" rule, intermission, round advance, and early completion leaving no
pending spawns.

## Known limitations

- Target shadows are baked with the rest of the scene, so a plate's shadow does not
  follow its swing. The trade is one shadow render per session instead of per frame.
- Bullet holes on the range are world space and capped at 96; older holes are
  recycled. Plates keep their own 10 hole ring buffer each.
- Only the closest impact per segment is resolved — rounds do not penetrate or
  ricochet.
- No wind, no spin drift, no zeroing adjustment: drop is the only external factor.
- The weapon models are recognisable placeholders, not art.
