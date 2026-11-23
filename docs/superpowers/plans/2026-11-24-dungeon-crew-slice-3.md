# Dungeon Crew Slice 3 (Floor 3 + Floor 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Floor 3 (Molten Forge, Rubble Golem, Hollow King, Hollow Crown shop) and Floor 4 (Ashen Stair + Dragon's Roost, Ashmaw, Victory screen), so a run goes from Floor 1 to the dragon.

**Architecture:** Same as Slices 1–2: the server decides everything (`server/`), shared UMD data (`shared/`), Phaser draws, HTML overlays for menus. New hazards live in a new `server/forge.js` (lava, bridge, geysers, jets, burning, crumbling) so `hazards.js` stays Floor 1–2. Each new monster gets its own AI file like `queen.js`.

**Tech Stack:** Node 18+, Express, Socket.IO, Phaser 3, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-24-dungeon-crew-slice-3-design.md`

## Global Constraints

- Every warning has a visible tell first: geyser glow 1.5 s, jet hiss 0.5 s, bridge flicker 1 s, golem slam raise 1 s, king sweep raise 1 s, shadow ring glow 1.5 s, breath glow 1.5 s, gust 2 flaps (1 s), meteor marks 1.5 s, ring crumble 2 s.
- Burning: 3 dmg/s for 3 s, re-burn restarts the timer, ignores defense. Forgewalker full set: geyser damage ×0.7, burning lasts 1 s.
- Lava: 50 damage and back to the room's respawn point (entrance; on the Roost, the island center). Ground monsters treat lava as wall; Skitterbats fly over.
- Numbers: Golem HP 120 dmg 20 xp 25 gold 10–15; King HP 600 (+150/extra player) dmg 25, 100 gold 200 XP; Ashmaw HP 1200 (+300/extra player) dmg 35, 300 gold.
- Hollow Crown: Crown Helm 150g +30 HP, Royal Plate 200g +9 def, Shadow Greaves 160g +20% speed; tier-3 weapon 200g +22 (Ember Blade / Shadow Bow / King's Scepter); set bonus dragon fire −40% and team +10% damage while a wearer is alive (no stacking).
- Levels to 10: LEVELS gains 1250, 1600.
- Every existing test keeps passing; every random recipe builds without fallback for 200 seeds.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01CEc7FtLAb2NdvgZhbVhMkn`.
- Push Floor 3 to GitHub `main` after Task 7, and everything after Task 11 (`git -c push.negotiate=true push origin slice-3:main`).

## Review Focus

1. A player standing on the bridge when it moves must ride it, never drop into lava. (Task 3 test `bridge carries riders`.)
2. A player Shield-Bashing a monster into lava, or a hero rolling over lava: lava rules apply exactly like pits (rolling does not save you). (Task 2 test `rolling over lava still burns you`.)
3. Melee during the dragon's sky phase must do nothing visible-but-silent: it gets an `outofreach` event, not damage. (Task 9 test.)
4. Crumbling the outermost ring must move anyone standing on it to lava rules, and the respawn point must never be a melted tile. (Task 8 test.)
5. After the final boss the game must end at the Victory screen, not open a shop with no items. (Task 9 test `beating Ashmaw ends the run`.)

---

## Decisions (rulings made while planning)

- **Jets cross the whole room** (mockup: "fire shoots across the room"), so a jet column can't avoid the entrance→door path. The spec's "never on the only path" is met by timing instead: the two jet groups alternate, so every column is idle 2 of every 3 s. Vents (`v`) count as blocking in the layout path check.
- **Golem "front"** is judged from the attacker's position (the player who owns the hit) against the golem's `facing` (angle toward its target): within ±90° = front = half damage. Hazard damage (no attacker) is full.
- **Melee** = Knight basic swing and Shield Bash. Everything else is ranged.
- **Last floor has `shop: null`**: clearing it goes to phase `done` after the floor-clear card.

## File map

- `shared/data.js` — new monsters, LEVELS, `SHOPS.crown`, `BURN`.
- `shared/tiles.js` — letters `l v j r`, spawns `G K D`, `isSolid` options `lavaSolid`.
- `shared/rooms.js` — Floor 3 and Floor 4 data, `ROOST`.
- `server/layout.js` — recipe keys `river`, `vents`, `jets`.
- `server/forge.js` (new) — burning, lava, bridge, geysers, jets, crumbling.
- `server/golem.js`, `server/king.js`, `server/dragon.js` (new) — AI.
- `server/game.js`, `server/enemies.js`, `server/ai.js`, `server/heroes.js`, `server/shop.js`, `server/index.js` — wiring.
- `shared/sprites.js` — `golem`, `king`, `dragon` maps.
- `client/js/game/scene.js`, `client/js/ui/shop.js`, `client/css/style.css` — drawing, victory screen.
- Tests: `test/forge.test.js`, `test/golem.test.js`, `test/king.test.js`, `test/dragon.test.js`, `test/floors3.test.js`.

---

### Task 1: Data, tiles and burning

**Files:** Modify `shared/data.js`, `shared/tiles.js`, `server/game.js`, `server/ai.js`. Test: `test/forge.test.js` (new), `test/floors.test.js`.

**Interfaces — Produces:**
- `data.MONSTERS.golem {hp:120,dmg:20,speed:35,r:22,xp:25,gold:[10,15]}`, `king {hp:600,dmg:25,speed:70,r:36,xp:200,gold:[100,100],hpPerExtraPlayer:0.25,boss:true}`, `dragon {hp:1200,dmg:35,speed:60,r:44,xp:0,gold:[300,300],hpPerExtraPlayer:0.25,boss:true,flying:true}`; `bat.overLava = true`.
- `data.LEVELS` ends `..., 950, 1250, 1600]`. `data.BURN = { perSecond: 3, duration: 3, forgeDuration: 1 }`.
- `data.SHOPS.crown` with pieces `helm3, plate3, boots3`, `weapon3` (+22, 200g), potion, feather; weapons `{knight:'Ember Blade', archer:'Shadow Bow', mage:"King's Scepter"}`.
- `tiles.SPAWN_LETTERS` adds `G: 'golem', K: 'king', D: 'dragon'`. `isSolid('j') === true`; `isSolid('l', {lavaSolid:true}) === true`, otherwise lava is walkable.
- `game.burnPlayer(p)`, `game.hasSet(p, ids: string[]) -> bool`, `game.forgeSet(p)`, `game.crownSet(p)`; snapshot `players[].burning`.
- `ai.moveEnemy` passes `lavaSolid: !MONSTERS[e.type].overLava`.

- [ ] **Step 1: Write failing tests** in `test/forge.test.js`:
  - `burning deals 3 per second for 3 seconds and ignores defense` — knight with defense 9, `burnPlayer`, run 4 s → hp dropped by 9.
  - `burning again restarts the timer instead of stacking` — burn, run 2 s, burn, run 4 s → total 15.
  - `the full Forgewalker set makes burning last 1 second` — owned helm2/plate2/boots2 → total 3.
  - `walking monsters treat lava as a wall, bats fly over it` — room with a lava column; gloop and bat chase a player on the far side for 3 s → gloop x stays left of lava, bat crosses.
  - in `test/floors.test.js` change `level 8 needs 950 XP` to also assert `level 10 needs 1600 XP`.
- [ ] **Step 2:** Run `node --test test/forge.test.js test/floors.test.js` → FAIL (`burnPlayer is not a function`).
- [ ] **Step 3: Implement.** Burning accumulates like `poisonPlayer` (fractional accumulator, whole-point hits, source `'burn'`), ticked in `tick` for every player with `burnUntil > time` (do it inside `forge.update`'s caller: add `this.updateBurning(dt)` in `game.tick` after hazards). Snapshot `burning: time < burnUntil`.
- [ ] **Step 4:** Run `npm test` → all pass.
- [ ] **Step 5:** Commit `feat: floor 3 data, lava tiles and burning`.

### Task 2: Lava, geysers and flame jets (`server/forge.js`)

**Files:** Create `server/forge.js`. Modify `server/game.js` (call `forge.update(game, dt)` in tick, `forge.reset(game)` in loadRoom, snapshot fields). Test `test/forge.test.js`.

**Interfaces — Produces:**
- `forge.reset(game)` builds `game.vents [{tx,ty,i}]`, `game.jets [{tx,ty,dir:{x,y},group,len}]` from the room grid; `game.bridge` (Task 3); `game.melted Set`, `game.crumbling Map` (Task 8).
- `forge.update(game, dt)`; `forge.respawnPoint(game) -> {x,y}`; `forge.ventState(game, i) -> 'idle'|'glow'|'erupt'`; `forge.jetState(game, group) -> 'idle'|'hiss'|'fire'`.
- Constants: vents cycle 6 s, offset `i * 1.5`, glow [0,1.5), erupt [1.5,3.5); eruption radius 40 px from the vent center, 30 damage (×0.7 forge set) + burn, once per eruption per entity. Jets cycle 3 s: group 0 hiss [0,0.5) fire [0.5,1.5), group 1 hiss [1.5,2) fire [2,3); beam from the nozzle inward until a solid tile; 15 damage once per firing per entity; nozzle direction from which border wall it sits in; group = index in reading order % 2.
- Snapshot: `vents: [{x,y,state}]`, `jets: [{x,y,dx,dy,len,state}]` (px, len in tiles).
- Events: `erupt {x,y}`, `jetfire {x,y,dx,dy,len}`, `lavafall {targetId}`.

- [ ] **Step 1: Write failing tests:**
  - `stepping in lava costs 50 and sends you to the entrance`.
  - `rolling over lava still burns you` (archer with `invulnUntil` in the future, on lava → still moved to entry and hp −50; lava ignores invulnerability like pits).
  - `a monster knocked into lava dies without a reward` (gold unchanged).
  - `a geyser glows for 1.5 s, then erupts for 30 damage and burning` (player on the vent: hp unchanged at 1.4 s, −30 by 1.6 s, `burning` true).
  - `the Forgewalker set cuts geyser damage to 21`.
  - `a geyser hits each player once per eruption` (stand 2 s through eruption → only one 30 hit plus burn ticks).
  - `jets hiss for 0.5 s, then fire across the room for 15` (nozzle in top wall at column 5, player at (5,6): hit between 0.5 and 1.5 s; a player at column 7 is not).
  - `the two jet groups take turns` (`jetState(game,0)==='fire'` at 1.0 s while group 1 is `'idle'`; reversed at 2.5 s).
  - `a pillar stops a jet beam` (pillar at (5,4) → player at (5,6) is never hit).
- [ ] **Step 2:** Run `node --test test/forge.test.js` → FAIL (`Cannot find module '../server/forge'`).
- [ ] **Step 3: Implement** `server/forge.js` with the constants above. Lava check uses the same tile-under rule as pits, plus "not on the bridge" (Task 3 adds `onBridge`; for now treat as false). Non-flying monsters on lava → `killEnemy(e,{reward:false})`. Monsters on an erupting vent or in a beam take the same damage.
- [ ] **Step 4:** Run `npm test` → pass.
- [ ] **Step 5:** Commit `feat: lava, geysers and flame jets`.

### Task 3: The moving bridge and river rooms

**Files:** Modify `server/forge.js`, `server/layout.js`. Test `test/forge.test.js`, `test/layout.test.js`.

**Interfaces — Produces:**
- Recipe key `river: { x: <first column> }` → columns x and x+1, rows 1..h−2 become `l`. Layout result gains `bridge: { tx: x, stops: [2..h-4] }` (top row of a 2-tile-tall bridge). Hand-made layouts may carry `bridge` too.
- `game.bridge = { x, y, w: 96, h: 96, stops: [y px...], stopIndex, moveAt, from, to, moveStart } | null`. Cycle: stays 3 s, `warn` for 1 s (flicker), glides 0.5 s to a different stop picked with `game.rng`. Riders (players whose center is inside the rect at the start of the tick) move with it.
- `forge.onBridge(game, x, y) -> bool`. Snapshot `bridge: {x,y,w,h,warn}|null`. Event `bridgemove`.
- Layout: `reachable()` treats `v` and `l` as blocking; for rooms with a river, the path and monster-spot checks run on a copy where the river is floor (the bridge reaches every stop in time). Monsters never start on `l`.

- [ ] **Step 1: Write failing tests:**
  - `the bridge stays 3 s, flickers 1 s, then moves to another stop`.
  - `bridge carries riders` (player on the bridge at its move → same offset from the bridge after the move, hp unchanged).
  - `standing on lava under the bridge is safe`.
  - layout: `river recipes always leave the door reachable across the bridge for 200 seeds` and `nothing is scattered onto the river`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** in `layout.js` and `forge.js` as above. `game.loadRoom` passes `layout.bridge` to `forge.reset`.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: lava river with a moving bridge`.

### Task 4: Rubble Golem

**Files:** Create `server/golem.js`. Modify `server/enemies.js` (dispatch), `server/game.js` (`damageEnemy` front check), `server/layout.js` (`MONSTER_LETTERS.golem = 'G'`). Test `test/golem.test.js`.

**Interfaces — Produces:**
- `golem.updateGolem(game, e, dt)`; `golem.frontFactor(game, e, byId) -> 0.5|1`. `e.facing` (radians toward its target) kept up to date; snapshot `enemies[].facing` (2 decimals).
- Ground Slam: when the target is within 2 tiles (96 px + target r) and `timers.slam` ready (first 2 s, every 5 s): state `'raise'` for 1 s, then everyone within 96 px takes 20; event `slam {x,y,r:96}`.
- `damageEnemy` event gains `armored: true` when the front factor applied.

- [ ] **Step 1: Tests:** `the golem raises its fists for 1 s then slams everyone within 2 tiles`; `a player 3 tiles away is safe from the slam`; `hits from the front do half damage, from behind full` (player in front vs behind, same attack); `hazard damage is never halved`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** (walks with `walkToward`, contact damage like other monsters).
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: rubble golem`.

### Task 5: The Hollow King

**Files:** Create `server/king.js`. Modify `server/enemies.js`. Test `test/king.test.js`.

**Interfaces — Produces:** `king.updateKing(game, e, dt)`.
- Royal Sweep: target within 120 px and `timers.sweep` ready (first 2 s, every 4 s) → state `'raise'` 1 s, then arc 140° (aim locked at raise start), range 110 px + target r, 25 damage; event `sweep {x,y,aim}`.
- Summon Court: every 20 s (first at 8 s) 3 Gloops (`noReward`) at the 3 room-corner floor tiles farthest from the King; event `court`.
- Phase 2 at hp ≤ half: once, event `crownflare`, speed ×1.4, `e.phase2 = true`. Shadow Ring every 6 s (first 1 s after flare): state `'ring'` 1.5 s, then 12 hostile projectiles `kind:'shadowBolt'`, 15 dmg, speed 260, life 3 s, evenly spaced; event `shadowring`.

- [ ] **Step 1: Tests:** `royal sweep warns for 1 s then hits in front, not behind`; `summon court calls 3 gloops that give no gold`; `at half HP the crown flares once and he gets faster`; `shadow ring fires 12 bolts after a 1.5 s glow, only in phase 2`; `king HP is 750 with two players`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: the hollow king`.

### Task 6: Floor 3 data, Hollow Crown shop and set bonuses

**Files:** Modify `shared/rooms.js`, `server/layout.js` (recipe `vents: [min,max]` → 1×1 `v`; `jets: n` → nozzles in top/bottom border walls, columns 3..w−4, at least 2 apart, alternating top/bottom), `server/game.js` (`playerDamage` ×1.1 while any alive player wears the full crown set), `server/index.js` (`DEBUG_FLOOR` gold: floor 3 → 500, floor 4 → 900, else 300). Test `test/floors3.test.js`.

**Interfaces — Produces:** `FLOORS[2] = { name:'Molten Forge', roomNames:['Ember Gate','Lava Run','Furnace Hall',"Hollow King's Hall"], shop:'crown', stalactites:false, rooms:[...] }` and `FLOOR3_NAME`, `FLOOR3_ROOM_NAMES`. Recipes:
- Ember Gate: vents [3,4], pit 1 (2×2), pillar [2,4]; gloop 3, golem 2.
- Lava Run: river x 11, vents [1,2], pillar [2,3]; bat 3, archer 2, golem 1.
- Furnace Hall: jets 4, vents 2, pillar [2,3]; golem 2, archer 2, bat 2.
- King's Hall: hand-made, 4 vents, 4 pillars, `K` at (14,6), jets in top/bottom walls at columns 6 and 17.

- [ ] **Step 1: Tests:** `Floor 3 is the Molten Forge with 4 rooms and the crown shop`; `Floor 3 recipes build valid rooms for 200 seeds` (no fallback; jets are in border walls; vents present); `the crown shop sells the Hollow Crown set and tier-3 weapons` (Ember Blade for a knight, +22); `the full crown set gives the whole team +10% damage while the wearer is alive` (mage teammate damage 13+5 → round ×1.1; drops back when the wearer is downed); `a second wearer doesn't stack it`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: floor 3 molten forge and hollow crown shop`.

### Task 7: Client — Floor 3 drawing, then push

**Files:** Modify `client/js/game/scene.js`, `shared/sprites.js` (maps `golem` 16×16 → 64 px, `king` → 96 px; `spriteFiles()` count 24), `client/js/ui/shop.js` (weapon name/slot use `item.slot === 'Weapon'`, fixes tier 2–3 names), `test/sprites.test.js` (count 24), README. Run `npm run sprites`.

Drawing (same style as the trap redraw: on the dungeon floor, sized to its tile):
- Lava `l`: dark red base, moving bright cracks (animated with time, redraw tiles each frame only for lava via a separate `lavaLayer` graphics so `tileKey` caching stays). Vents: dark cone; `glow` pulses orange; `erupt` draws a tall lava column + `flame` bursts. Jet nozzle `j`: metal slot in the wall; `hiss` small sparks; `fire` beam rectangle along `len` tiles with flame bursts. Bridge: stone slab with planks, flickers alpha when `warn`.
- Burning players: orange tint flicker and `flame` particles.
- Golem/King tells: `'raise'` uses the existing white-flash tell and `!`; King/dragon get the big bar. `shadowBolt` shot: purple orb with trail. Events: `erupt`, `jetfire`, `lavafall` ("Lava!" floater), `slam`, `sweep` (big arc ring), `court`, `crownflare` (banner "The King's crown flares!"), `shadowring`, damage events with `armored` show grey numbers.
- [ ] **Step 1:** `node --check` every changed client file; `npm test` → pass.
- [ ] **Step 2:** Headless check: `DEBUG_FLOOR=3 DEBUG_ROOM=0|1|2|3 node .superpowers/tmp/smokes2.js f3rN 2600` → `errors: []`; look at each screenshot (lava, bridge, jets, king visible and matching the floor style).
- [ ] **Step 3:** Commit `feat: client draws floor 3`, then push `slice-3:main`.

### Task 8: Floor 4 rooms and crumbling platforms

**Files:** Modify `shared/rooms.js` (`ROOST`, `FLOORS[3]`), `server/forge.js` (crumble), `server/game.js` (last floor with `shop: null` → `done`). Test `test/floors3.test.js`, `test/forge.test.js`.

**Interfaces — Produces:**
- `FLOORS[3] = { name:'Dragon's Roost', roomNames:['Ashen Stair','Dragon's Roost'], shop:null, rooms:[ashen recipe, { layout: ROOST }] }`. Ashen Stair: vents [2,3], jets 2, pillar [2,3]; golem 2, archer 2, bat 2.
- `ROOST`: walls around; lava columns 1–3 and 20–22; island columns 4–19 rows 1–11 of `r`, except the core (columns 8–15, rows 4–8) which is `f`; entry `e` at (5,6); `D` at (12,6); no door.
- `forge.ringOf(game, tx, ty) -> 0|1|2|3` (Chebyshev distance from the core; 0 = core). `forge.crumbleRing(game)` marks the outermost remaining ring: tiles go into `game.crumbling` for 2 s (snapshot `crumbling` px tiles list), then into `game.melted` (count as lava). Returns false after 3 rings. Event `ringfall`.
- `forge.respawnPoint(game)`: room has `r` tiles → core center; else entry.

- [ ] **Step 1: Tests:** `Floor 4 is two rooms ending in the Roost, with no shop`; `Ashen Stair builds valid rooms for 200 seeds`; `crumbling warns for 2 s, then the outer ring is lava`; `crumbling stops after 3 rings and never touches the core`; `a player on a crumbled tile takes lava damage and lands on the core`; `clearing the last floor ends the run without a shop` (tiny one-floor `floors` with `shop:null` → phase `done`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: floor 4 rooms and crumbling roost`.

### Task 9: Ashmaw, the Ember Dragon

**Files:** Create `server/dragon.js`. Modify `server/enemies.js`, `server/heroes.js` (swing and bash call `damageEnemy(e, n, id, { melee: true })`), `server/game.js` (`damageEnemy(e, amount, byId, opts = {})`; sky + melee → event `outofreach {x,y}` and 0; zones snapshot `aim`, `spread`). Test `test/dragon.test.js`.

**Interfaces — Produces:** `dragon.updateDragon(game, e, dt)`; `e.sky` (snapshot `enemies[].sky`), `e.facing`.
- Attack loop on the ground (one attack at a time, next one 2.5 s after the last ends, picked in order breath → gust → breath → meteor):
  - Fire Breath: state `'breathe'` 1.5 s, zone `breathWarn {aim, spread: 70°, r: 280}`; then everyone in that cone takes 35 + burning (both ×0.6 with the crown set). Event `breath {x,y,aim}`.
  - Wing Gust: state `'flap'` 1 s, then every player is pushed 192 px straight away from the dragon (collision with walls only, so they can land in lava). Event `gust`.
  - Meteor Rain: state `'fly'`, invulnerable, 1.5 s marks: one `meteorMark` zone (r 48) on each alive player plus 3 random island tiles; then 30 damage (×0.6 crown) to anyone inside a mark; event `meteor`. Then it lands at the core center.
- Tail Swipe: any player behind (angle from `facing` > 120°) within 110 px and `timers.tail` ready (every 5 s) → state `'tail'` 0.8 s, then half circle behind, 25 damage; event `tail`. Only on the ground.
- Phase 2 (≤60% HP, event `takeoff`): `e.sky = true`, melee can't hit; only breath and meteor; after each Meteor Rain it lands (`sky=false`), stunned 3 s (event `landed`), then takes off again.
- Phase 3 (≤25% HP, event `roostcrumble`): `forge.crumbleRing` now and every 15 s.
- Walks toward its target to ~100 px, lava solid for its movement.

- [ ] **Step 1: Tests:** `fire breath glows 1.5 s then burns everyone in the cone`; `the crown set cuts dragon fire by 40%`; `wing gust pushes players 4 tiles away`; `tail swipe hits only players behind`; `meteor marks warn 1.5 s, then hit only inside them`; `in the sky melee does nothing and says out of reach, arrows still hit`; `after meteor rain in phase 2 it lands stunned for 3 s and melee hits`; `phase 3 crumbles the roost every 15 s`; `beating Ashmaw ends the run` (Roost room with low-HP dragon → kill → after the card, phase `done`, each player +300 gold).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: ashmaw the ember dragon`.

### Task 10: Client — Floor 4 and the Victory screen

**Files:** Modify `client/js/game/scene.js`, `shared/sprites.js` (`dragon` → 128 px; count 25), `test/sprites.test.js`, `client/js/ui/shop.js` (`renderEnd`), `server/shop.js` (`shopState` adds `final: bool`, `time: seconds`), `client/css/style.css`, README.

- Roost: `r` drawn as stone slabs with darker seams; `crumbling` tiles shake and glow orange; melted tiles draw as lava.
- Dragon: lifted 24 px with a big shadow when `sky`; hidden with only a shadow sweeping when state `fly`; tells flash; breath cone drawn during `breathWarn` (fills as it charges); `meteorMark` red circles that shrink; events `breath` (flame cone burst), `gust` (white wind rings), `tail`, `meteor`, `takeoff`/`landed`/`roostcrumble` banners, `outofreach` floater "Out of reach!".
- Victory screen when `state.final`: eyebrow "Victory", title "Ashmaw is defeated!", team cards with level and gold, "Time played mm:ss", trophies row (class Legendary weapon per player — Dragonfang Sword / Emberstorm Bow / Wyrmflame Staff — Phoenix Feather, 300 gold), button "Back to lobby". Non-final end screen keeps the "coming soon" text.
- [ ] **Step 1:** `node --check` changed files; `npm test` → pass.
- [ ] **Step 2:** Headless: `DEBUG_FLOOR=4 DEBUG_ROOM=0|1` screenshots, `errors: []`; check the Roost and dragon read well.
- [ ] **Step 3:** Commit `feat: client draws floor 4 and the victory screen`.

### Task 11: Finish

- [ ] Final self-review of the whole branch (no subagents in this session); fix Critical/Important with a failing test first.
- [ ] `npm test` green; README "How to play" covers Floors 3–4 and `DEBUG_FLOOR=3|4`.
- [ ] Push `slice-3:main`.
