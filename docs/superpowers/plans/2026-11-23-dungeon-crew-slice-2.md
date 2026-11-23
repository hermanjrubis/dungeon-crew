# Dungeon Crew Slice 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Random trap layouts in every non-boss room, and Floor 2 (Fungal Caverns) with Bone Archers, Sporecaps, poison, stalactites, dark zones, the Spore Queen and a second shop.

**Architecture:** Floors become data (`shared/rooms.js` `FLOORS`): each room is either a hand-made `layout` or a `recipe` (fixed shape + what to scatter). The server builds layouts with a seeded random generator (`server/layout.js`) when a floor starts, keeps them for room retries, and sends the current room's rows in every snapshot. Everything else follows Slice 1: server decides, browser draws.

**Tech Stack:** unchanged — Node ≥18, Express, Socket.IO, Phaser 3, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-23-dungeon-crew-slice-2-design.md`

## Global Constraints

- All Slice 1 tests keep passing (adjusted only where the spec changes behavior).
- Layout rules: nothing within 2 tiles (Chebyshev) of the entry or any door tile; no overlaps; monsters on plain floor, ≥ 5 tiles from the entry, on tiles reachable from the entry; a path entry → door avoiding `w`, `p`, `x` always exists; 50 tries then fall back to the recipe's `fallback` rows.
- Retrying a room keeps its layout; a new game builds new layouts.
- Boss rooms are hand-made (`layout`, never `recipe`).
- Numbers from the spec: Archer HP 30 / dmg 8 / Volley every 5 s, 1 s draw, 3 arrows / bones rebuild after 5 s; Sporecap HP 40 / puff every 4 s, 2-tile trigger, 3 s cloud at 3/s / seed every 15 s, grows in 10 s, max 6 per room; poison pool 4/s; stalactite 1 s shadow, 15 dmg; dark sight 3 tiles; Queen HP 400 (+50%/extra player), dmg 12, teleport every 8 s (0.6 s shimmer), Spore Storm 3 safe circles 2 s then 15, Vine Grab 1 s ring then 1.5 s root, Royal Guard 2 Sporecaps, dark at half HP, 70 gold / 150 XP; Forgewalker 80/110/90g (+20 HP, +6 def, +15% speed), tier-2 weapon 120g +14; LEVELS `[0,50,120,220,350,500,700,950]`; Archer 15 XP / 5–8 gold; Sporecap 12 XP / 4–6 gold.
- Cellar Guard full set: poison damage −50%.

## Review Focus

1. **A random layout traps a monster where nobody can reach it** → room can never clear. Test in Task 1 (`monsters only start on tiles reachable from the entry`).
2. **Players see different layouts** → snapshot carries the server's rows. Test in Task 2.
3. **Everyone falls and the room comes back with different traps** → same layout on retry. Test in Task 2.
4. **A player leaves during a floor change or the Floor 2 shop** → the others continue. Test in Task 3.
5. **Sporecaps keep spawning so the room never ends** → cap of 6 (seeds count). Test in Task 6.

---

## File Structure

```
server/rng.js        seeded random numbers (mulberry32) so a layout can be rebuilt
server/layout.js     buildRoom(recipe, rng): scatter hazards/pillars/monsters, check rules
shared/rooms.js      FLOORS: names, room names, recipes/layouts, shop id, flags
shared/data.js       + archer, bones, sporecap, seed, queen; SHOPS per floor; LEVELS to 8
server/game.js       floors, layouts, floor flow, poison, root, snapshot room payload
server/heroes.js     hostile projectiles hit players; rooted players can't move
server/enemies.js    + Bone Archer, bones, Sporecap, seed (dispatch)
server/queen.js      Spore Queen
server/hazards.js    + poison pools, stalactites, torches
server/shop.js       per-floor shop, next floor or done
shared/sprites.js    + archer, bones, sporecap, seed, queen maps
client/js/game/scene.js, effects.js, ui/hud.js, ui/shop.js, css   drawing all of it
```

---

### Task 1: Seeded random + layout generator

**Files:** Create `server/rng.js`, `server/layout.js`; Test `test/layout.test.js`

**Interfaces:**
- Produces `makeRng(seed: number) → () => number in [0,1)` (mulberry32).
- Produces `buildRoom(recipe, rng) → { rows: string[], dark: [x0,y0,x1,y1][], torches: [{tx,ty}], fallback: bool }`.
- Recipe shape: `{ shape: string[] (w/f/e/d), scatter: [{ kind: 'spikes'|'pit'|'puddle'|'poison'|'pillar', count: n | [min,max], size: [w,h] }], monsters: { type: count }, dark?: [x0,y0,x1,y1] (tiles), torches?: n (placed inside dark), fallback: string[] }`. Letters: spikes `s`, pit `p` with a ring of `x`, puddle `u`, poison `o`, pillar `w`. Monster letters: gloop `g`, bat `b`, archer `a`, sporecap `c`.

- [ ] **Step 1: Write failing tests** (500 seeds × each Floor 1/2 recipe from Task 2's data — for this task use two local test recipes, one per floor style):
  - `same seed gives the same room, different seeds give different rooms`.
  - `shape is kept`: border walls, `e` and every `d` in the same place.
  - `scatter counts match the recipe` (count of `s` tiles = patches × w × h, etc.; pillars within [min,max]).
  - `nothing within 2 tiles of the entry or the door`.
  - `there is always a safe path from entry to door` (BFS over tiles not in `w p x`).
  - `monsters start on plain floor, ≥ 5 tiles from the entry, reachable from the entry` (Review Focus 1).
  - `torches sit on floor inside the dark area`.
  - `impossible recipe falls back to the hand-made rows` (e.g. 400 spike patches) → `fallback: true`, `rows === recipe.fallback`.
- [ ] **Step 2:** Run `node --test test/layout.test.js` — fail.
- [ ] **Step 3:** Implement. Place each scatter item at a random top-left on all-`f` tiles honoring clearance; pits get a 1-tile `x` ring (the ring also must be on `f`); then monsters; then validate path; retry up to 50.
- [ ] **Step 4:** Run — pass. **Step 5:** Commit `feat: seeded room layout generator`.

### Task 2: Floors as data; Game uses layouts; snapshot carries the room

**Files:** Modify `shared/rooms.js`, `server/game.js`, `client/js/game/scene.js`, `client/js/ui/hud.js`; Tests `test/tiles.test.js`, `test/floors.test.js`

**Interfaces:**
- `shared/rooms.js` → `FLOORS = [{ name, roomNames: string[], shop: 'cellar'|'forge', stalactites: bool, rooms: [{ recipe } | { layout: string[], dark?, torches?: [{tx,ty}] }] }]`. Floor 1 rooms 1–3 become recipes reproducing the Slice 1 hazard mix; room 4 keeps the hand-made lair. Floor 2 data added in Task 9 (Floor 2 entry may start as a copy of Floor 1 shapes until then).
- `Game(players, { floors = FLOORS, rooms, rng, seed, transitions, floorIndex = 0 })`: passing `rooms` (array of rows) still works and means one floor with those fixed layouts (keeps every existing test).
- `game.floorIndex`, `game.floor`, `game.layouts` (built once per floor: `{ rows, dark, torches }[]`), `game.startFloor(i)`.
- Snapshot adds `floorIndex`, `floorName`, `floorCount`, `room: { key, rows, dark, torches: [{x,y,lit}] }`, `allDark`.
- Client builds its room from `snap.room.rows` when `snap.room.key` changes (no more `DC.rooms.FLOOR1` lookup).

- [ ] **Step 1: Write failing tests** in `test/floors.test.js`:
  - `two games with different seeds lay out room 1 differently; the same seed lays it out the same`.
  - `the snapshot sends the rows the server is using` (Review Focus 2): `snap.room.rows` deep-equals `game.layouts[game.roomIndex].rows`.
  - `everyone falling keeps the same layout` (Review Focus 3).
  - `boss room is always the hand-made lair`.
  - Update `tiles.test.js` room checks to walk `FLOORS` (recipes' shapes and fallbacks 24×13; hand-made layouts' safe path).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement; client reads rows from the snapshot; HUD title uses `Floor N · Room x of y`.
- [ ] **Step 4:** `npm test` — pass; headless check that a game starts and draws with no console errors.
- [ ] **Step 5:** Commit `feat: floors as data with random layouts sent to every player`.

### Task 3: Floor flow, per-floor shops, levels to 8, set bonus

**Files:** Modify `shared/data.js`, `server/shop.js`, `server/game.js`, `server/index.js`; Test `test/shop.test.js`, `test/floors.test.js`

**Interfaces:**
- `shared/data.js` → `SHOPS = { cellar: { setName, setBonus, setPieces: ['helm','mail','boots'], items, weapons }, forge: { setName: 'Forgewalker Set', setPieces: ['helm2','plate2','boots2'], items: [helm2 80 {maxHp:20}, plate2 110 {defense:6}, boots2 90 {speedMul:0.15}, weapon2 120 {weaponBonus:14}, potion 15, feather 50], weapons: { knight:'Steel Sword', archer:'Longbow', mage:'Crystal Staff' } } }`; `LEVELS = [0,50,120,220,350,500,700,950]`.
- `shopState(game)` adds `floorName`, `nextFloorName | null`; `checkDone`: all ready → `startFloor(next)` (phase `playing`, everyone full HP, ready flags cleared, start card `Floor 2 · Fungal Caverns`) or `phase 'done'` after the last floor.
- `game.playerPoisonResist(p) → 0.5` when the player owns all Cellar Guard pieces, else `0`.
- `game:done` payload adds `floorsCleared`, `nextFloorName`.

- [ ] **Step 1: Write failing tests:**
  - `ready in the Floor 1 shop starts Floor 2 with level, gold and gear kept and full HP`.
  - `the Floor 2 shop sells the Forgewalker set and tier-2 weapons`; `weapon2 replaces the weapon bonus with 14`.
  - `after the last floor's shop the game is done`.
  - `a player leaving during the Floor 1 shop lets the others go on to Floor 2` (Review Focus 4).
  - `level 8 needs 950 XP`.
  - `full Cellar Guard set halves poison` (uses Task 4's poison call — write this test in Task 4).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** `npm test` — pass.
- [ ] **Step 5:** Commit `feat: floor-to-floor flow with per-floor shops`.

### Task 4: Poison, hostile projectiles, rooting

**Files:** Modify `server/game.js`, `server/heroes.js`; Test `test/status.test.js`

**Interfaces:**
- `game.poisonPlayer(p, perSecond, dt)` accumulates fractional damage in `p.poisonAcc`, deals whole points through `damagePlayer(p, n, 'poison')`, scaled by `1 − playerPoisonResist(p)`; event `{type:'poisoned', targetId}` at most once per 0.5 s.
- Projectiles with `hostile: true` hit players (`dist ≤ p.r + pr.r`, skip downed and invulnerable) and ignore enemies.
- `p.rootUntil`: `heroes.move` and rolling skip while rooted; attacks and skills still work. Snapshot player adds `rooted`, `poisoned` (poisoned in the last 0.5 s).

- [ ] **Step 1: Write failing tests:** `poison 3 per second deals 3 damage over 1 s`; `full Cellar Guard set halves poison`; `enemy arrows hurt players but not monsters`; `dodge roll dodges enemy arrows`; `rooted players can't walk but can still attack`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat: poison, enemy projectiles and rooting`.

### Task 5: Bone Archer and bones

**Files:** Modify `server/enemies.js`, `shared/data.js`; Test `test/archer.test.js`

**Interfaces:**
- Data: `archer { hp:30, dmg:8, speed:90, r:16, xp:0, gold:[0,0], reward:{ xp:15, gold:[5,8] } }`, `bones { hp:1, r:14, flying:true, xp:0, gold:[0,0] }`.
- AI: keep 240 px from target (back away under 160); `timers.volley` (first 2 s, then every 5): state `'draw'` 1 s, then 3 hostile arrows (`kind:'enemyArrow'`, speed 420, ttl 1.5, angles aim −0.25/0/+0.25, dmg 8).
- On death by a player: spawn `bones` (invulnerable, `rebuildAt = time + 5`, `fromArcher: true`). A living player within 24 px of bones → bones removed, archer `reward` paid to everyone, event `'bonesBroken'`. At `rebuildAt` → bones become a full-HP archer, event `'rebuild'`. Killed by a pit → no bones, no reward.

- [ ] **Step 1: Write failing tests:** `archer backs away when you are close`; `volley draws for 1 s then fires 3 arrows in a fan`; `killed archer leaves bones that rebuild after 5 s`; `standing on the bones destroys them and pays 15 XP and 5 gold`; `the room is not clear while bones remain`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat: bone archer`.

### Task 6: Sporecap and seeds

**Files:** Modify `server/enemies.js`, `shared/data.js`; Test `test/sporecap.test.js`

**Interfaces:**
- Data: `sporecap { hp:40, dmg:0, speed:0, r:18, xp:12, gold:[4,6] }`, `seed { hp:1, speed:0, r:8, xp:0, gold:[0,0] }`.
- Puff: player within 96 px and `timers.puff` ready → state `'swell'` 0.6 s → zone `poisonCloud` r 72 for 3 s (3/s via `poisonPlayer`); next puff 4 s after release.
- Seed: `timers.seed` (first 8 s, every 15): spawn `seed` (noReward) on a random walkable floor tile within 3 tiles; `growAt = time + 10` → becomes `sporecap` with `noReward`, unless the room already has 6 sporecaps+seeds (then the seed just withers).

- [ ] **Step 1: Write failing tests:** `sporecap swells then puffs poison when you come close`; `standing in the cloud poisons 3 per second`; `seed grows into a sporecap after 10 s`; `one hit breaks a seed`; `never more than 6 sporecaps and seeds in a room` (Review Focus 5).
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat: sporecap`.

### Task 7: Floor 2 hazards — poison pools, stalactites, dark zones and torches

**Files:** Modify `server/hazards.js`, `server/game.js`; Test `test/hazards2.test.js`

**Interfaces:**
- Tile `o` = poison pool: players 4/s via `poisonPlayer`; walking monsters take 4/s too (fractional → `enemyPoisonAcc`).
- Stalactites when `game.floor.stalactites` and not the boss room: `game.nextRock` every 3–5 s (`rng`); zone `rockShadow` r 32 under a random living player (±48 px, on floor) for 1 s; then 15 damage to players and walking monsters within 32 px; event `'rockfall'`.
- Torches: `game.torches = [{ x, y, lit }]` from the layout; a living player holding `interact` within 48 px of an unlit torch lights it (event `'torchlit'`). Snapshot `room.torches`.

- [ ] **Step 1: Write failing tests:** `poison pools hurt 4 per second`; `a stalactite shadow shows for 1 s, then the rock hits for 15`; `stalactites don't fall in boss rooms`; `holding E next to a torch lights it for everyone`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat: floor 2 hazards`.

### Task 8: Spore Queen

**Files:** Create `server/queen.js`; Modify `server/enemies.js` (dispatch `queen`), `shared/data.js`; Test `test/queen.test.js`

**Interfaces:**
- Data: `queen { hp:400, dmg:12, speed:0, r:36, xp:150, gold:[70,70], hpPerExtraPlayer:0.5, boss:true }`.
- Timers (first / every): teleport 8/8 (`'shimmer'` 0.6 s, invulnerable, then a random reachable floor tile ≥ 4 tiles from every player); storm 6/14 (3 `safeCircle` zones r 64 for 2 s, state `'storm'`; at the end 15 poison damage to every living player outside all circles); vine 3/7 (`vineRing` r 40 at a player for 1 s, then players inside: 6 damage + root 1.5 s); guard 10/15 (2 Sporecaps, noReward, slid out from her).
- At ≤ 50% HP: `game.allDark = true` (event `'darkness'`), once.

- [ ] **Step 1: Write failing tests:** `shimmer then teleport somewhere far from players`; `spore storm spares players in a safe circle`; `vine grab roots the player after 1 s`; `royal guard grows 2 sporecaps`; `the lair goes dark at half HP`; `queen HP scales with players`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5:** Commit `feat: spore queen`.

### Task 9: Floor 2 data and sprites

**Files:** Modify `shared/rooms.js`, `shared/sprites.js`, `client/assets/*` (regenerated); Test `test/sprites.test.js`, `test/floors.test.js`

- Floor 2: name `Fungal Caverns`, rooms `['Glowing Tunnels', 'Mushroom Grove', 'The Dark Hollow', "Spore Queen's Lair"]`, shop `forge`, `stalactites: true`. Room 1 recipe: 3 bats + 2 archers, poison pools, pillars. Room 2: 3 archers + 3 sporecaps, poison, puddles, pillars. Room 3: 2 bats + 2 archers + 2 sporecaps, dark rect covering the right half, 3 torches. Room 4 (hand-made): open lair, `Q` in the middle, 4 torches near the corners.
- Sprites: `archer` (Bone Archer map from the mockups), `sporecap` (mockup map), `queen` (Bosses mockup map), `seed` and `bones` (new 16×16). Sizes: archer 48, sporecap 48, seed 24, bones 40, queen 96.

- [ ] **Step 1: Failing tests:** `Floor 2 recipes build valid rooms for 200 seeds`; sprite map test covers the new maps.
- [ ] **Step 2–4:** fail → implement → `npm run sprites` → pass. **Step 5:** Commit `feat: floor 2 rooms and sprites`.

### Task 10: Client — draw Floor 2

**Files:** Modify `client/js/game/scene.js`, `client/js/game/effects.js`, `client/js/ui/hud.js`, `client/js/ui/shop.js`, `client/css/style.css`, `client/js/ui/lobby.js` (none expected)

- Tiles: poison pool `o` (bubbling green). Darkness: a mask over tiles in `room.dark` (or all tiles when `allDark`) at 0.92 alpha, cleared within 144 px of my hero and 192 px of lit torches; drawn above monsters; the Queen's glowing spots drawn above it. Torches: unlit/lit with flicker and a "Hold E" hint when near.
- Monsters: archer (draw = flash + bow string), bones (pile with a 5 s rebuild ring), sporecap (swell = grow), seed (pulsing), queen (shimmer = flicker/fade, storm = glow).
- Zones/projectiles: enemy arrows (red), poisonCloud (green fog), safeCircle (bright ring), vineRing (green ring tightening), rockShadow (growing shadow).
- Effects for events: `rockfall` (rubble + shake), `bonesBroken`, `rebuild`, `torchlit`, `darkness` (banner + shake), `poisoned` (green bubbles on the player), rooted (vines around the player).
- HUD: `Floor N · Room x of y`; poison indicator. Shop and end screen use `floorName` / `nextFloorName` / `floorsCleared`.

- [ ] **Step 1:** Implement. **Step 2: Verify** headless: `DEBUG_FLOOR=2` env starts at Floor 2 with gold 300; play 10 s with two players, screenshots of room 1, a dark room (`DEBUG_ROOM=2`), and the Queen (`DEBUG_ROOM=3`); no console errors.
- [ ] **Step 3:** Commit `feat: client draws floor 2`.

### Task 11: README, full verification, push

- [ ] Update README (Floor 2, random layouts, new controls note: E also lights torches, `DEBUG_FLOOR`/`DEBUG_ROOM` switches).
- [ ] `npm test` all pass; headless run Floor 1 → shop → Floor 2 start with no console errors.
- [ ] Commit `docs: README for slice 2`; push branch `slice-2` to GitHub `main`.
