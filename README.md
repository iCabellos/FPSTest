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

Launching the game shows a mode menu, then a **loadout screen** before the
match. The range lets you carry a primary and a sidearm; zombies only lets you
choose the pistol you open with, since the rest of the arsenal is earned inside
the mansion. Weapons are not bound to the number keys — you carry two and swap
with `Q`.

Losing pointer lock pauses whichever mode is loaded and offers resume or quit.

### Mobile

On a touchscreen the game mounts a touch layer and skips pointer lock entirely;
a desktop never sees it.

- **Left half** — a movement stick, invisible until a thumb lands on it, which
  appears wherever you press.
- **Right half** — drag anywhere to look around, using raw pixel deltas so it
  feels the same as a mouse.
- **FIRE** — always visible and semi transparent. It locks onto the nearest
  walker ahead the moment you press it and opens fire half a second later, so
  a thumb never has to track a target.
- **SWAP** — changes to your other weapon.
- **MENU**, top left — leaves the match.

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

### Deployment

Every push and pull request runs `.github/workflows/ci.yml`: type check, lint,
tests and a production build, with the built `dist/` uploaded as an artifact.

Production hosting is Vercel, connected to this repository. Pull requests get a
preview deployment and merging to `main` promotes to production, so the
pipeline is: green CI on the PR → merge → Vercel builds and deploys `main`.
`npm run build` is the same command Vercel runs, so a green build locally is
the same build that ships.

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
| `Q`     | Swap to your other weapon         |
| `F`     | Buy / take whatever you are stood at: door, wall buy, ammo, mystery box (zombies) |
| `T`     | Reset targets and statistics (range) |
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

Eighteen weapons, in six classes.

| Weapon         | Class          | Modes     | RPM | Mag | Character                                          |
| -------------- | -------------- | --------- | --- | --- | -------------------------------------------------- |
| M4A1           | Assault rifle  | auto/semi | 800 | 30  | Fast, controllable, mild climb                     |
| AK-47          | Assault rifle  | auto/semi | 600 | 30  | Heavy kick, wide horizontal walk                   |
| SCAR-L         | Assault rifle  | auto/semi | 600 | 30  | Firmer push, short straight climb                  |
| G36C           | Assault rifle  | auto/semi | 750 | 30  | The most forgiving. Fast, flat, light damage       |
| FN FAL         | Battle rifle   | semi/auto | 650 | 20  | 7.62. Hits twice as hard and fights you for it     |
| M60            | Machine gun    | auto      | 550 | 100 | Belt fed. Slow to raise, bloom grows fast          |
| L96A1          | Sniper         | semi      | 90  | 10  | Bolt action, 6x scope, one shot at a time          |
| MP5            | SMG            | auto/semi | 800 | 30  | Flat and controllable, slow arcing 9 mm            |
| MP7            | SMG            | auto/semi | 950 | 40  | Fastest cadence, lightest kick, wanders sideways   |
| UMP45          | SMG            | auto/semi | 600 | 25  | Slow thumping .45 that drops hard past 100 m       |
| Uzi            | SMG            | auto/semi | 600 | 32  | A hose for corridors, useless past fifty metres    |
| Remington 870  | Shotgun        | semi      | 300 | 8   | Pump action, 8 pellets, shell by shell reload      |
| SPAS-12        | Shotgun        | semi      | 240 | 6   | Semi auto, 9 pellets, wider and harder kicking     |
| M9             | Sidearm        | semi      | 420 | 17  | Even and forgiving, seventeen of them              |
| M1911          | Sidearm        | semi      | 380 | 7   | Seven of .45. Hits harder, empties fast            |
| Desert Eagle   | Hand cannon    | semi      | 260 | 7   | .50 AE. Rifle damage, and it bucks for it          |
| Magnum         | Hand cannon    | semi      | 200 | 6   | Six of .357, refilled a cylinder at a time         |
| One Armed Bandit | Special      | semi      | 70  | 30  | Fires no bullets. Spins five reels                 |

Three reload styles, declared per weapon and driving both the mechanic and the
animation. `magazine` swaps a detachable box, drum or belt in one pass.
`shells` feeds one round at a time and **can be broken off mid string** by
pulling the trigger, which is the whole point of a tube fed shotgun. `internal`
refills a fixed cylinder in place, so nothing detaches and nothing is animated
falling away.

Shotguns declare `projectile.pellets`, and every pellet is sampled from the
cone independently — a pattern, not a slow rifle round.

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

Solo, playable end to end. Pick a pistol on the loadout screen, spawn in the
foyer, and hold the mansion for as long as you can.

### The mansion

`map/layout.ts` is the declarative floor plan and the single source of truth:
geometry, player collision, the navigation graph, the window openings and every
purchase point are all derived from it. A wall always blocks what it looks like
it blocks, and a navigation edge always follows a real opening. Doorways and
windows are *cut* out of wall runs rather than placed by hand.

Eight rooms — foyer, great hall, kitchen, library, dining room, study, gallery
and vault — laid out with loops so you can circle back rather than being
funnelled down a corridor. Each room has its own flooring, and the wall and
floor textures carry the outbreak: damp running from the ceiling, panelling,
grime and dried blood.

### Coming in through the windows

Zombies never spawn inside the building. They appear on the lawn, walk around
the outside, stop at a boarded window, pull the planks off one at a time, and
climb over the sill.

This is a property of the map rather than of any behaviour written on top of
it. The only navigation edges that cross the outer shell are the window ones,
and they are **one way**: a walker climbs in and stays in, so a route can never
treat the house as a shortcut between two points on the lawn. Each window leaves
a solid sill below it and a solid header above it, so the opening is see-through
and shoot-through while the sill still stops the player walking out.

The placement decides the whole difficulty curve. The free starting area only
touches the outside along the foyer's front wall, so round one always comes
through those two windows. Buying a door opens that wing's windows as new lanes
at the same time as it opens the route — the map gets harder as it gets bigger.
A spawn point is only used when an open route from it to the player exists, so
a sealed wing stays quiet until you pay for it.

### Hitboxes

Two volumes per walker, both matching what is actually drawn: a sphere on the
head and a standing cylinder for the body. The head is tested first and wins
ties, so a round that clips both counts as the headshot you were aiming for.
A headshot does 2.5× damage and pays double.

### Buying things

Everything is bought with `F`, and one query decides what you are stood at, so
the prompt and the purchase can never disagree.

- **Doors and debris** (`map/Barrier.ts`) — $750 to $2000. A closed barrier
  blocks bullets, movement *and* navigation; opening one is permanent.
- **Wall buys** (`map/WallBuy.ts`) — chalked boards with the weapon hanging in
  front of them, from the $500 M1911 in the foyer to the $2600 M60 in the
  gallery. Buying one you already carry tops it up at the cheaper ammo price.
- **Ammo boxes** — five of them: great hall, kitchen, library, gallery and
  vault. $650 restocks whatever is in your hands.
- **The mystery box** (`zombies/MysteryBox.ts`) — $950. It lands in a random
  room each match, never in the free starting area. The lid opens, guns flick
  past, and it settles on one. Take it with `F`, or it is handed over anyway
  when the offer times out — you are never charged for nothing.

You carry two weapons. Buying a third replaces the one in your hands, which is
what makes choosing what to hold at the box matter.

### Ammunition

Ammo is limited. Every weapon has a magazine and a reserve behind it, and a
reload draws from the reserve — including a partial reload when the reserve is
nearly gone, so you get what is left rather than a full magazine. Once it is
empty it stays empty until you buy a restock. The shooting range passes
`infiniteReserve` and is unaffected.

### The special weapon

`ONE ARMED BANDIT` hangs on the vault wall for $4000 — the last room, behind
every other purchase, and the most expensive thing in the mansion. It is meant
to be absurd, and it is built to be impossible to ignore.

It fires no bullets. Every pull throws the lever and starts **five real reel
drums** turning behind glass on the cabinet roof. They stop left to right on a
stagger, each one landing on the symbol the rules actually rolled — the
`SlotMachineAnimator` picks each detent at the moment that reel stops, against
the angle it has really reached, so a reel only ever turns forwards and never
jerks backwards onto its mark.

Nothing pays out until the last reel bites. That is the whole point of watching
a slot machine, and it is why the payout is deferred rather than resolved on
the trigger pull.

The cabinet is covered in things that react:

- **A marquee of fourteen bulbs** ringing the back panel — the face the player
  actually looks at. Each has its own material, so the chase is a run of light
  going round rather than one lamp blinking. Amber and slow at idle, faster
  while the reels turn, and a full rainbow cycle on a win.
- **A beacon** on the roof that turns faster the more is happening, from a lazy
  idle to a hard spin on a jackpot.
- **A payout lamp** in the middle of the marquee that hard strobes on a
  jackpot.
- **Neon strips** down both flanks and a glowing payout horn.
- **Coins** (`special/CoinBurst.ts`) sprayed out of the tray on any win, pooled
  and instanced, bouncing off the floor. Pure spectacle — they hit nothing —
  which is exactly why they are there.

`special/SlotMachine.ts` still owns the rules: every X does nothing, every
GRENADE throws one grenade with the throws fanned twenty degrees apart
clockwise, a lone NUCLEAR does nothing, and five NUCLEAR is the jackpot. Thirty
uses, no reserve.

The result is projected into the world as laser strokes
(`special/LaserReadout.ts`), never as HUD text: five symbol glyphs and a bar of
twenty pity ticks, thrown onto whatever the weapon is pointing at. A jackpot
readout throbs, swells and hangs around twice as long.

Grenades (`special/GrenadeSwarm.ts`) are pooled and integrated by hand — a
point with a velocity, a gravity term and one floor bounce. The jackpot
(`special/NukeSequence.ts`) pulls the camera straight up, drops a bomb on the
mansion, and kills everything belonging to the **current round** only.

Every one of these has its own sound, and they are the only tonal sounds in the
game — see below.

### Rounds and economy

`rounds/RoundManager.ts` holds the strict rule that a round is finished only
once every zombie belonging to it has both spawned *and* died — clearing the
map is not enough while walkers are still queued. Budgets grow per round and
per player, with a live cap.

You start on 500 points: 10 a hit, 20 a headshot, 60 a kill, 100 a headshot
kill. Health regenerates after 4.5 seconds without damage. Purchases are
validated the way a host would validate them: the thing must exist, still be
available, and be affordable.

### Zombies rendering

The whole crowd renders as four `InstancedMesh` layers (torso, head, two arms),
so hundreds of walkers cost four draw calls and nothing is created or destroyed
while playing.

**Not built yet:** co-op networking, Pack-a-Punch, and the Desert Eagle,
revolver, Uzi, SCAR-L, G36, FAL, Remington 870 and SPAS-12.

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
2. Add it to `ALL_WEAPONS` and `WEAPONS_BY_ID` in
   `src/weapons/definitions/index.ts`, and to the `WeaponId` union.
3. Add a model in `src/weapons/viewmodel/models/`, built from the vocabulary in
   `viewmodel/parts.ts`, and register it in `WeaponModelFactory.ts`.
4. Put it somewhere it can be obtained: `RANGE_PRIMARIES` or `SIDEARMS` in
   `loadout/loadout.ts`, a `WALL_BUYS` entry in `map/layout.ts`, or `BOX_POOL`
   in `zombies/MysteryBox.ts`.

No other file needs to change. Fire mode, bolt action and scope behaviour all follow
from the definition: give it a `boltCycleTime` and it becomes bolt action, give its
`ads` a `scope` and it gets the scope overlay.

### The weapon inspector

A development tool, served by `npm run dev` at **`/inspect.html`** and
deliberately left out of the production build.

The first person view only ever shows one weapon, from one angle, in motion, at
the edge of the frame. That is the worst possible place to notice that a part is
floating, mirrored, buried inside the receiver or half a centimetre off the bore
line. The inspector renders the same models the game uses, from fixed
orthographic angles, with the bore line, ten centimetre ticks and every anchor
drawn on top.

```
/inspect.html?sheet=left        contact sheet of all eighteen, from the left
/inspect.html?sheet=top         ... top, bottom, right, front, back, iso
/inspect.html?weapon=fal&view=top   one weapon, large
/inspect.html?fp=m4a1           first person, through the real ViewModel and
                                the game's own view lighting
/inspect.html?fp=m4a1&ads=1     ... aimed, to check the sight lands on centre
/inspect.html?fp=m4a1&pull=0.3  ... camera drawn back, pose untouched, so the
                                whole weapon is in frame
```

Flags: `&anchors=0`, `&grid=0`, `&wire=1`.

It also writes a measurement table to `window.__inspect` and the console —
length, height, width, muzzle and sight offsets, and **`muzzleGap`**, the
distance from the muzzle anchor to the front of the model. That last column is
the one that matters: the flash, smoke and tracer all start at that anchor, so
if it drifts out in front of the barrel every shot appears to leave from thin
air. Four weapons were caught doing exactly that — the L96 by 30 cm and the
three pistols by 5 to 6 cm — and `tests/models.test.ts` now asserts it.

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

### Audio

Everything is synthesised at runtime through the Web Audio API; there are no
audio assets. A shot is four layers — a transient snap, a filtered crack unique
to the weapon, a doubled low body, and the mechanical clack of the action — all
soft clipped together for weight.

**There is deliberately no reverb.** An earlier version fed every shot into a
convolution tail meant to stand in for range walls and mansion corridors. With
no early energy to anchor it that tail was most of what you heard, and the guns
came out airy and distant — closer to arrows in flight than to rifles. The tail
is gone, capped hard where it remains, and the size now comes from doubling the
low body underneath the shot instead.

The slot machine is the exception and the contrast: it is the only thing in the
game that plays **notes**. Fat detuned square and sawtooth runs — a lever
ratchet, a rising click per reel as they land, a major arpeggio on a win, and a
two octave run with a siren over it on a jackpot. Nothing else is tonal, so the
moment the cabinet does anything it is unmistakable.

Any sound can still be replaced by a real sample through `loadSample`, which
takes priority over the synthesised fallback.

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

For the mansion: doorway and window cutting (including that a window removes
exactly its own area and always leaves the sill solid), that every window is in
the outer shell and opens onto the room it claims, and that no wall buy is
mounted across a doorway or a window — the layout is checked, not eyeballed.

The chase loop is simulated headlessly rather than assumed. `tests/siege.test.ts`
builds the real navigation graph, spawns a walker on the lawn and steps it at a
fixed rate: it has to walk round the house, stop at a window, pull off all four
planks, climb over the sill without floating on the approach or clipping through
the wall under it, end up inside, and land a melee hit. A whole wave is run the
same way from every corner of the lawn. Two real bugs were found and fixed this
way — walkers ping-ponging because repathing re-anchored on the node behind them,
and routes cutting through the building by hopping in one window and out another.

## Known limitations

- Target shadows are baked with the rest of the scene, so a plate's shadow does not
  follow its swing. The trade is one shadow render per session instead of per frame.
- Bullet holes on the range are world space and capped at 96; older holes are
  recycled. Plates keep their own 10 hole ring buffer each.
- Only the closest impact per segment is resolved — rounds do not penetrate or
  ricochet.
- No wind, no spin drift, no zeroing adjustment: drop is the only external factor.
- The weapon models are built from primitives rather than sculpted. They carry
  real detail — rails with individual slots, curved magazines, vented ribs,
  fluted barrels, cut ejection ports — but they are still recognisable
  placeholders, not art.
- Boarded windows cannot be repaired. A plank that comes off is off for good,
  so a window is a delay rather than a renewable defence.
- The zombies mode is solo. There is no networking of any kind, and the menu
  does not offer co-op rather than showing a dead button.
