# Dungeon Crew Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable online co-op dungeon crawler slice: menu → room code lobby → character select → Floor 1 (3 rooms + Gloop Mother) → camp shop → end screen.

**Architecture:** One Node.js process serves the client files (Express) and runs every room's game on the server (Socket.IO, 20 ticks/s). Browsers send inputs and draw snapshots. Rules shared by both sides (tiles, room maps, numbers, sprites) live in `shared/` as plain scripts that work in Node and the browser. Menus, lobby, HUD and shop are plain HTML/CSS; Phaser 3 draws only the dungeon.

**Tech Stack:** Node.js ≥18, Express 4, Socket.IO 4, Phaser 3 (served from `node_modules`), `node:test` for tests, `socket.io-client` (dev) for the integration test.

**Spec:** `docs/superpowers/specs/2026-11-23-dungeon-crew-slice-1-design.md`

## Global Constraints

- Vanilla JavaScript only. No TypeScript, no bundler, no build step; `npm install` then `npm start` must run it.
- Server is authoritative: clients never send positions, damage or gold.
- Tick rate 20/s; `tick(dt)` clamps `dt` to at most 0.1 s.
- Tile 48 px; rooms 24 × 13 tiles; view 1280 × 720 scaled to fit the window.
- Up to 4 players per room; colors orange `#F2A541`, blue `#6C9BF2`, teal `#5EC8B8`, pink `#E58FB8`, each once per room.
- All tunable numbers live in `shared/data.js`; room layouts in `shared/rooms.js`.
- Every damaging skill or hazard has a visible tell before it lands (sent in snapshots as a state the client draws).
- Code is commented in plain English so the two student developers can explain it.

## Review Focus

1. **A player disconnects mid-floor or in the shop** → the game continues; door/shop "everyone ready" checks count only connected players. Tests in Task 3 and Task 8.
2. **Room code typed in lowercase or with spaces** (`" k7qf "`) → joins room `K7QF`. Test in Task 2.
3. **Host leaves the lobby** → the next player becomes host and can start. Test in Task 2.
4. **Long server hiccup or background tab** (`tick(2)`) → no one passes through walls; dt is clamped. Test in Task 3.
5. **Malformed client input** (`aim: NaN`, `up: "yes"`, missing fields) → treated as no input, never crashes. Test in Task 3.

---

## File Structure

```
package.json
server/index.js        Express static + Socket.IO wiring (events ↔ Lobby/Game)
server/lobby.js        Room codes, players, picks, lock-in, host, start
server/game.js         Game class: tick loop, rooms, doors, rewards, downed/revive/reset, snapshot
server/heroes.js       Player movement, attacks, skills, projectiles, zones
server/enemies.js      Gloop, Mini Gloop, Skitterbat AI
server/boss.js         Gloop Mother + Half Mother AI
server/hazards.js      Spikes, crumbling floor, pits, puddles
server/shop.js         Shop buying and readiness
shared/tiles.js        Tile constants, room parsing, collision
shared/data.js         Heroes, monsters, levels, shop items, colors
shared/rooms.js        Floor 1 room maps
shared/sprites.js      Pixel maps + palettes (from the mockups)
tools/make-sprites.js  Writes client/assets/*.png from shared/sprites.js
client/index.html      Screens (menu, lobby, game, shop, end) + script tags
client/css/style.css   Look from the mockups
client/js/net.js       Socket.IO wrapper
client/js/ui/menu.js   Main menu screen
client/js/ui/lobby.js  Lobby + character select screen
client/js/ui/hud.js    HTML HUD over the canvas
client/js/ui/shop.js   Shop + end screens
client/js/game/scene.js Phaser scene: draws snapshots, sends input, predicts own movement
client/js/main.js      Screen switching, boot
test/*.test.js
README.md
```

Shared files use this wrapper so they load in both places:
`(function (root, f) { typeof module === 'object' ? module.exports = f() : (root.DC = root.DC || {}, root.DC.<name> = f()); })(this, function () { ... return api; });`

---

### Task 1: Scaffold, shared tiles, data and rooms

**Files:**
- Create: `package.json`, `shared/tiles.js`, `shared/data.js`, `shared/rooms.js`
- Test: `test/tiles.test.js`, `test/data.test.js`

**Interfaces:**
- Produces `shared/tiles.js`: `TILE=48, ROOM_W=24, ROOM_H=13`;
  `parseRoom(rows: string[]) → { w, h, grid: string[][], entry: {x,y}, door: [{tx,ty}], spawns: [{type, x, y}] }` (spawn letters become floor `f`; `e` = entry tile, `d` = door);
  `tileAt(room, px, py) → char` (outside the grid = `'w'`);
  `isSolid(char, {doorOpen}) → bool` (walls; doors unless open);
  `moveWithCollision(room, x, y, dx, dy, radius, {doorOpen}) → {x, y}` (move x then y; stop at solid tiles).
- Produces `shared/data.js`: `HEROES`, `MONSTERS`, `LEVELS`, `SHOP_ITEMS`, `COLORS`, `TICK_RATE=20`, `CLASSES=['knight','archer','mage']`.
- Produces `shared/rooms.js`: `FLOOR1: string[][]` — 4 rooms of 13 rows × 24 chars. Tile chars: `w` wall, `f` floor, `s` spikes, `x` cracked, `p` pit, `u` puddle, `d` door (right wall), `e` entry (left side). Spawns: `g` Gloop, `b` Skitterbat, `M` Gloop Mother. Room 1: 4 g, spikes. Room 2: 3 g + 2 b, cracked floor over pit. Room 3: 4 g + 3 b, all hazards. Room 4: M only, puddles.

Values for `data.js` (from the spec and mockups):

| Hero | hp | baseDmg | starter bonus | speed px/s | attack |
|---|---|---|---|---|---|
| knight | 120 | 10 | Wooden Sword +4 | 150 | swing arc 90°, r 64, cd 0.5 |
| archer | 80 | 7 | Training Bow +3 | 210 | arrow 600 px/s, ttl 1.2, cd 0.4 |
| mage | 70 | 13 | Apprentice Staff +5 | 180 | bolt 480 px/s, ttl 0.9, cd 0.6, 5 mana; mana 100, regen 8/s |

Skills: knight q Shield Bash cd 6 (front 120°, r 72, push 96, stun 1, dmg 8); space Taunt cd 12 (r 240, 3 s). archer q Arrow Rain cd 10 (r 96, at aim up to 360 px, 2 s, 5 dmg per 0.25 s); space Dodge Roll cd 4 (160 px in 0.25 s, invulnerable). mage q Fireball cd 3, 20 mana (420 px/s, blast r 64, dmg 24); space Heal Circle cd 12, 30 mana (r 96, 10 HP/s for 3 s).

Monsters: gloop hp 20, dmg 5, speed 60, xp 10, gold [2,4]; minigloop hp 8, dmg 3, speed 70, xp 3, gold [1,1]; bat hp 12, dmg 4, speed 160, xp 8, gold [3,6], flying; mother hp 250, dmg 10, speed 40, xp 100, gold [40,40], hpPerExtraPlayer 0.5; halfmother hp 60, dmg 8, speed 55, xp 0, gold [0,0].
`LEVELS = [0, 50, 120, 220, 350]` (xp needed for levels 1–5; each level +10 max HP, +2 dmg).
`SHOP_ITEMS`: helm 40 `{maxHp:10}`, mail 60 `{defense:3}`, boots 45 `{speedMul:0.10}`, weapon 70 `{weaponBonus:8}` named per class (Iron Sword / Hunter's Bow / Oak Staff), potion 15 `{potions:1}`, feather 50 `{feathers:1}`; armor and weapon `once:true`. Health Potion heals 40.

- [ ] **Step 1:** `npm init -y`; set `"type": "commonjs"`, scripts `"start": "node server/index.js"`, `"test": "node --test test/"`, `"sprites": "node tools/make-sprites.js"`, `"engines": {"node": ">=18"}`; `npm install express@4 socket.io@4 phaser@3`; `npm install -D socket.io-client@4`. Add `.gitignore` with `node_modules/`.
- [ ] **Step 2: Write failing tests** in `test/tiles.test.js`:
  - `parseRoom finds entry, door and spawns` — for `FLOOR1[0]`: `entry` is the center of the `e` tile, `door.length ≥ 1`, 4 spawns of type `gloop`, and spawn tiles read back as `'f'`.
  - `every Floor 1 room is 24×13` — each room has 13 rows of 24 chars.
  - `walls block movement` — start 1 tile right of a wall, `moveWithCollision(room, x, y, -200, 0, 16, {})` leaves `x - 16 ≥` wall's right edge.
  - `closed door blocks, open door lets through` — same check against a `d` tile with `doorOpen:false` / `true`.
  - `pits are not solid` — moving onto a `p` tile succeeds.
  - `outside the map counts as wall` — `tileAt(room, -5, -5) === 'w'`.
  In `test/data.test.js`: `heroes match the character select` — knight total damage `baseDmg + starter bonus === 14`, archer `10`, mage `18`; hp 120/80/70.
- [ ] **Step 3:** Run `npm test` — expect failures (modules missing).
- [ ] **Step 4:** Implement `shared/tiles.js`, `shared/data.js`, `shared/rooms.js` as above.
- [ ] **Step 5:** Run `npm test` — all pass.
- [ ] **Step 6:** Commit `feat: shared tiles, data and Floor 1 rooms`.

---

### Task 2: Lobby

**Files:** Create `server/lobby.js`; Test `test/lobby.test.js`

**Interfaces:**
- Produces `class Lobby({ rng = Math.random })` with:
  `createRoom(socketId, name) → { ok, code }`;
  `joinRoom(socketId, name, code) → { ok, code } | { ok:false, error }` (errors: `'No room with that code'`, `'Room is full'`, `'Game already started'`);
  `pick(socketId, { heroClass?, color? }) → { ok } | { ok:false, error }` (error `'Color taken'`; ignored while locked);
  `setLocked(socketId, locked: bool)`;
  `start(socketId) → { ok } | { ok:false, error }` (`'Only the host can start'`, `'Everyone must lock in'`);
  `leave(socketId) → room | null`;
  `roomOf(socketId) → room | null`;
  `publicState(room) → { code, hostId, phase, players: [{ id, name, heroClass, color, locked }] }`.
- Room shape: `{ code, hostId, phase: 'lobby'|'playing'|'shop'|'done', players: Map, game: null }`.
- New players get the first free color and `heroClass 'knight'`.

- [ ] **Step 1: Write failing tests:**
  - `codes are 4 capital letters without I or O` (regex `/^[A-HJ-NP-Z]{4}$/`).
  - `join with lowercase and spaces works` — `joinRoom('b', 'Mira', '  ' + code.toLowerCase() + ' ')` ok.
  - `fifth player is refused` — error `'Room is full'`.
  - `each color once per room` — second player picking the host's color gets `'Color taken'`.
  - `names are trimmed, max 12 chars, blank becomes "Player"`.
  - `only host can start, and only when all locked`.
  - `host leaving passes host to next player` — `hostId` becomes the second player's id; they can start.
  - `cannot join after start` — `'Game already started'`.
  - `last player leaving deletes the room` — a later join with that code fails.
- [ ] **Step 2:** Run `node --test test/lobby.test.js` — fail.
- [ ] **Step 3:** Implement `server/lobby.js`.
- [ ] **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: lobby with room codes, picks and host`.

---

### Task 3: Game core — movement, rooms, doors, rewards, downed/revive/reset

**Files:** Create `server/game.js`, `server/heroes.js` (movement part only); Test `test/game.test.js`

**Interfaces:**
- Produces `class Game(players: [{id, name, heroClass, color}], { rooms = FLOOR1, rng = Math.random })` with:
  `time` (seconds), `phase: 'playing'|'shop'|'done'`, `roomIndex`, `room` (parsed), `doorOpen`,
  `players: Map<id, Player>`, `enemies: Enemy[]`, `projectiles: []`, `zones: []`,
  `setInput(id, raw)` — sanitizes to `{ up, down, left, right, attack, q, space, interact, use1, use2: bool, aim: finite number (else 0) }`;
  `removePlayer(id)`; `tick(dt)`; `snapshot() → object`; `drainEvents() → Event[]`;
  helpers for other modules: `damagePlayer(p, amount, source)` (applies `max(1, amount − defense)`, ignores invulnerable/downed), `damageEnemy(e, amount, byId)`, `healPlayer(p, amount)`, `spawnEnemy(type, x, y, opts) → Enemy`, `addProjectile(obj)`, `addZone(obj)`, `event(obj)`, `alivePlayers() → Player[]`, `playerDamage(p) → number` (`baseDmg + weaponBonus + 2·(level−1)`).
- Player: `{ id, name, heroClass, color, x, y, r: 16, hp, maxHp, mana, maxMana, level, xp, gold, defense, speedMul, weaponBonus, weaponName, potions: 1, feathers: 0, owned: [], downed, reviveProgress, cd: {attack, q, space}, slowUntil, stunUntil, invulnUntil, aim, input, connected: true }`.
- Enemy: `{ id, type, x, y, r, hp, maxHp, dmg, speed, flying, state, stateUntil, targetId, noReward }`.
- Events: `{ type: 'damage', targetId, amount }`, `'levelup'`, `'roomclear'`, `'nextroom'`, `'reset'`, `'downed'`, `'revived'`, `'phase'`.
- Snapshot: `{ t, phase, roomIndex, roomCount, doorOpen, broken: [tileIndex], spikes: 'down'|'rattle'|'up', players: [...], enemies: [{ id, type, x, y, hp, maxHp, state }], projectiles: [{ id, kind, x, y }], zones: [{ id, kind, x, y, r, until }] }` with positions rounded to integers.
- Consumes: `heroes.updatePlayer(game, p, dt)` (this task: movement only, using `moveWithCollision` and `speed·speedMul`, halved slows stack as max slow), later tasks add combat.

Rules: room clear (no enemies left) → `doorOpen = true`, event `roomclear`. Any non-downed player touching a door tile while open → next room: all players to `entry` (downed ones revived at 30% HP), event `nextroom`. After the last room is cleared → `phase = 'shop'`. Kill rewards: every connected player gets the monster's gold (random in range via `rng`) and xp; `noReward` enemies give nothing. Level-up per `LEVELS`. Downed at hp ≤ 0. A living player within 48 px holding `interact` fills `reviveProgress` of a downed teammate; at 3 s → revived at 30% max HP. `use1` drinks a potion (+40 HP). `use2` uses a feather on the nearest downed teammate within 96 px (revive at 50%). If no connected player is alive → room reset: enemies respawned from spawns, broken tiles restored, projectiles/zones cleared, players at entry with full HP, event `reset`. Boss HP: `hp · (1 + hpPerExtraPlayer · (players − 1))`.

- [ ] **Step 1: Write failing tests** (use a tiny 3-room test map built with `parseRoom`, `rng = () => 0`):
  - `players start at the room entry`.
  - `moving right changes x by speed·dt` — knight `right:true`, `tick(0.05)` → `x` up by `150·0.05`.
  - `tick(2) cannot pass through a wall` (Review Focus 4).
  - `malformed input is ignored` — `setInput(id, { up: 'yes', aim: NaN })`, then `tick` → position unchanged, no throw (Review Focus 5).
  - `killing the last enemy opens the door and gives gold and xp to everyone`.
  - `touching the open door moves everyone to the next room`.
  - `clearing the last room switches to shop`.
  - `holding E for 3 s next to a downed teammate revives them at 30%`.
  - `feather revives the nearest downed teammate at 50%`.
  - `everyone downed resets the room` — enemies back to spawn count, players full HP at entry, event `reset`.
  - `disconnected player does not block reset or count as alive` (Review Focus 1).
  - `defense reduces damage but never below 1`.
  - `boss HP scales with extra players` — 2 players → mother hp 375.
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement `server/game.js` and movement in `server/heroes.js`.
- [ ] **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: server game core with rooms, rewards and revive`.

---

### Task 4: Hero combat

**Files:** Modify `server/heroes.js`; Test `test/heroes.test.js`

**Interfaces:**
- Consumes Game helpers from Task 3.
- Produces in `server/heroes.js`: `updatePlayer(game, p, dt)` now also handles `attack`, `q`, `space` per hero using `HEROES[cls]` numbers; `updateProjectiles(game, dt)`; `updateZones(game, dt)` (called by `Game.tick`).
- Projectile kinds: `arrow`, `bolt`, `fireball`; zone kinds: `arrowRain`, `healCircle`, `fireBlast` (0.3 s visual), `taunt` (on player). Knight taunt sets `game.tauntBy = { id, until }` read by enemy targeting (Task 5 uses `pickTarget(game, e)` exported from `server/enemies.js`).

- [ ] **Step 1: Write failing tests:**
  - `knight swing hits enemy in front but not behind`.
  - `shield bash pushes back 96 px and stuns 1 s`.
  - `archer arrow travels and damages the first enemy it touches`.
  - `dodge roll makes the archer invulnerable while rolling`.
  - `mage bolt costs 5 mana and fails at 0 mana`.
  - `fireball explodes for 24 damage in radius 64`.
  - `heal circle heals a teammate inside 10 HP per second, not one outside`.
  - `arrow rain deals 5 every 0.25 s for 2 s`.
  - `cooldowns block reuse` — second `q` within 6 s does nothing.
  - `stunned or downed players cannot act`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: hero attacks and skills`.

---

### Task 5: Monsters — Gloop, Mini Gloop, Skitterbat

**Files:** Create `server/enemies.js`; Test `test/enemies.test.js`

**Interfaces:**
- Produces `updateEnemy(game, e, dt)` (dispatch by type; boss types delegate to `server/boss.js` from Task 7), `pickTarget(game, e) → Player|null` (taunting knight within range first, else closest alive, ignores downed), `onEnemyDeath(game, e)` (Gloop splits into 2 Mini Gloops unless `noReward`).
- Contact damage: once per 0.8 s per target.
- Gloop: walks toward target; every 4 s if target within 4 tiles → `state 'squish'` for 1 s (does not move), then `'leap'` 0.4 s to the target's position captured at squish end (max 144 px), landing hits players within 30 px for `dmg`.
- Skitterbat: flying; circles at ~4 tiles; every 3 s `'swoop'` dash 380 px/s up to 0.5 s, bite on touch, then `'retreat'` away for 2 s; every 8 s `'screech'` tell 0.6 s then slows players within 144 px by 30% for 2 s.

- [ ] **Step 1: Write failing tests:**
  - `gloop squishes for 1 s before leaping` — state `'squish'`, position unchanged across 0.9 s.
  - `gloop leap lands near the target and deals damage`.
  - `gloop splits into two mini gloops on death; minis do not split`.
  - `brood gloops (noReward) do not split and give no gold`.
  - `bat screech tells for 0.6 s then slows nearby players`.
  - `bat flies over pits`.
  - `enemies ignore downed players`.
  - `taunt pulls enemies onto the knight`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: gloop and skitterbat AI`.

---

### Task 6: Hazards

**Files:** Create `server/hazards.js`; Test `test/hazards.test.js`

**Interfaces:**
- Produces `updateHazards(game, dt)`, `spikeState(time) → 'down'|'rattle'|'up'` (cycle 3 s: down 0–1.5, rattle 1.5–2.0, up 2.0–3.0), `resetHazards(game)`; Game keeps `game.broken: Set<tileIndex>` and `game.cracking: Map<tileIndex, breakAt>`.
- Rules: spikes 10 damage once per up-phase per entity (players and walking enemies). Cracked tile starts cracking when stepped on, becomes pit 1 s later. Pit (or broken tile) under a walking entity's center: player → back to `entry`, −15 HP (`damagePlayer`, can down them); walking enemy dies with no reward. Puddle: walking speed ×0.6. Flying enemies ignore all hazards.

- [ ] **Step 1: Write failing tests:**
  - `spike cycle timing` — `spikeState(1.0)==='down'`, `1.7 → 'rattle'`, `2.5 → 'up'`, `3.2 → 'down'`.
  - `spikes hit a player once per up phase`.
  - `cracked tile breaks 1 s after being stepped on`.
  - `falling in a pit sends the player to entry with −15 HP`.
  - `gloop pushed into a pit dies and gives no gold`.
  - `puddle slows walking to 60%`.
  - `room reset restores broken tiles`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: floor 1 hazards`.

---

### Task 7: Gloop Mother

**Files:** Create `server/boss.js`; Test `test/boss.test.js`

**Interfaces:**
- Produces `updateBoss(game, e, dt)` for `mother` and `halfmother`; called from `updateEnemy`.
- Belly Flop every 6 s: zone `flopShadow` at target position for 1.5 s, boss `state 'airborne'` (invulnerable, not drawn), then lands there: 20 damage to players within 72 px. Brood every 12 s (mother only): 2 Gloops with `noReward: true`. Slime Trail: while moving, every 0.5 s a `slime` zone r 24 for 4 s; players inside slowed 40%. At hp ≤ 50% → mother removed, two `halfmother` spawned beside her (hp 60 each, Belly Flop only, smaller).
- Room clears only when all boss parts and spawned Gloops are dead.

- [ ] **Step 1: Write failing tests:**
  - `belly flop shows a shadow for 1.5 s, is untargetable, then hits players under it`.
  - `brood spawns 2 no-reward gloops every 12 s`.
  - `slime trail slows players 40%`.
  - `at half HP the mother splits into two 60 HP halves`.
  - `room clears only after both halves and all gloops die`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: gloop mother boss`.

---

### Task 8: Shop

**Files:** Create `server/shop.js`; Modify `server/game.js` (expose `buy`, `setShopReady`); Test `test/shop.test.js`

**Interfaces:**
- Produces `buy(game, playerId, itemId) → { ok } | { ok:false, error }` (`'Not enough gold'`, `'Already owned'`, `'Shop is closed'`), `setShopReady(game, playerId, ready)`, `shopState(game) → { items, players: [{ id, gold, owned, ready, potions, feathers }] }`. Weapon item name/bonus comes from the buyer's class. Buying applies stats immediately (`maxHp` also raises `hp`). When every connected player is ready → `phase = 'done'`.

- [ ] **Step 1: Write failing tests:**
  - `buying deducts gold and applies stats`.
  - `cannot buy without enough gold`.
  - `armor and weapon can be bought once; potions many times`.
  - `weapon is the buyer's class weapon` — archer buys `Hunter's Bow`, `weaponBonus 8`.
  - `all connected players ready → done; a disconnected player does not block it` (Review Focus 1).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit `feat: camp shop`.

---

### Task 9: Server wiring and integration test

**Files:** Create `server/index.js`; Test `test/integration.test.js`

**Interfaces:**
- Produces `createServer({ port }) → Promise<{ port, close() }>` (exported; `node server/index.js` calls it with `process.env.PORT || 3000`).
- Static: `/` → `client/`, `/shared/` → `shared/`, `/vendor/phaser.min.js` → `node_modules/phaser/dist/phaser.min.js`.
- Socket events (client → server, with ack where noted): `room:create {name}` (ack), `room:join {name, code}` (ack), `lobby:pick {heroClass?, color?}`, `lobby:lock {locked}`, `lobby:start` (ack), `input {...}`, `shop:buy {itemId}` (ack), `shop:ready {ready}`.
  Server → client: `lobby:state` (publicState), `game:start {you}`, `game:snapshot`, `game:events [..]`, `shop:state`, `game:done`.
- One `setInterval` per server at 1000/20 ms ticks every playing game, emits snapshots + drained events to the room's Socket.IO room, emits `shop:state` while in shop.
- Disconnect → `lobby.leave` + `game.removePlayer`.

- [ ] **Step 1: Write failing test** `two players create, join, pick, lock, start and get snapshots` — start on port 0, two `socket.io-client` connections, second picks archer + teal, both lock, host starts, both receive `game:start` and a `game:snapshot` with 2 players within 1 s; then `close()`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run full `npm test` — pass.
- [ ] **Step 5:** Commit `feat: socket server wiring`.

---

### Task 10: Sprites

**Files:** Create `shared/sprites.js`, `tools/make-sprites.js`, `client/assets/*.png` (generated); Test `test/sprites.test.js`

**Interfaces:**
- Produces `shared/sprites.js`: `MAPS` (16×16 rows from the mockups: knight, archer, mage, gloop, bat, mother; minigloop and halfmother reuse gloop/mother), `heroPalette(heroClass, colorHex)`, `MONSTER_PALETTES`, `SCALE = 3`.
- `tools/make-sprites.js` writes `client/assets/<hero>-<color>.png` (12 files) and `gloop.png`, `minigloop.png`, `bat.png`, `mother.png`, `halfmother.png` as 48×48 (minigloop 30×30, halfmother 72×72, mother 96×96) using Node `zlib` and a hand-written PNG encoder (no dependency).

- [ ] **Step 1: Write failing test** `every map is 16 rows of 16 chars and every letter has a palette color`.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement both files; run `npm run sprites`.
- [ ] **Step 4:** Run tests — pass; `file client/assets/knight-orange.png` reports `PNG image data, 48 x 48`.
- [ ] **Step 5:** Commit `feat: pixel sprites as replaceable PNGs`.

---

### Task 11: Client — menu, lobby and character select

**Files:** Create `client/index.html`, `client/css/style.css`, `client/js/net.js`, `client/js/ui/menu.js`, `client/js/ui/lobby.js`, `client/js/main.js`

**Interfaces:**
- `net.js` → `window.Net = { socket, create(name) → Promise<ack>, join(name, code) → Promise<ack>, pick(obj), lock(bool), start() → Promise<ack>, sendInput(obj), buy(itemId) → Promise<ack>, ready(bool), on(event, fn) }`.
- `main.js` → `App.show(screenId)` toggles `#menu`, `#lobby`, `#game`, `#shop`, `#end`; stores `App.me` (socket id) and the latest lobby state.
- Screens follow the mockups: menu (name, Create room, code + Join, How to play), lobby + character select combined (room code, player slots, hero cards with sprite `<img>`, color swatches with taken ones disabled, stats bars, skills, Lock in, Start for host). Errors from acks show under the form.

- [ ] **Step 1:** Implement the files.
- [ ] **Step 2: Verify:** `npm start`, `curl -s localhost:3000 | grep -c 'id="menu"'` → `1`; `node --check` on every client JS file passes; with a headless browser (Playwright if installable), two pages create/join the same room and both show 2 players in the lobby, with no console errors.
- [ ] **Step 3:** Commit `feat: client menu, lobby and character select`.

---

### Task 12: Client — game scene and HUD

**Files:** Create `client/js/game/scene.js`, `client/js/ui/hud.js`; Modify `client/index.html`, `client/js/main.js`

**Interfaces:**
- Consumes snapshot shape (Task 3), sprite PNG names (Task 10), `DC.tiles`, `DC.rooms`, `DC.data`.
- `scene.js` → `GameScene` (Phaser.Scene): loads PNGs; draws the current room tiles (colors from the Floors mockup; spikes by `snapshot.spikes`, broken tiles as pits, door open/closed); draws players (name, HP bar, downed = faded + revive ring), enemies (HP bars; tells: squish = flattened, swoop/screech = flash, airborne = hidden), projectiles, zones (shadow, slime, arrow rain, heal circle, fire blast), floating damage numbers from events. Sends input 20×/s from WASD, mouse aim/click, Q, Space, E, 1, 2. Own hero moves locally with `moveWithCollision` and eases toward the server position (snap if > 48 px off); others are interpolated between the last two snapshots.
- `hud.js` → `Hud.update(snapshot, meId)`: HP/mana/XP/level/gold, teammates' HP, "Room x of 4", hotbar (potions, feathers, Q/Space cooldowns), room clear / reset banners.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:** `node --check` passes; headless browser: two players start a game, both canvases render (screenshot non-empty), holding `D` for 1 s moves the player's x in the next snapshot, no console errors.
- [ ] **Step 3:** Commit `feat: client game scene and HUD`.

---

### Task 13: Client — shop, end screen, README and delivery

**Files:** Create `client/js/ui/shop.js`, `README.md`; Modify `client/index.html`, `client/js/main.js`, `server/index.js` (the `DEBUG_SKIP_TO_SHOP` test switch)

**Interfaces:**
- Consumes `shop:state`, `Net.buy`, `Net.ready`, `game:done`.
- Shop screen as in the mockup: character preview, set progress (x of 3), set bonus text, item cards with Buy / Owned, gold, teammates' ready state, "Ready for Floor 2". End screen: "Floor 1 cleared! Floor 2 coming soon" with each player's level and gold, and "Back to menu".
- README: what the game is, `npm install` / `npm start`, playing on the same Wi-Fi (`http://<laptop-ip>:3000`), putting it online (Render: new Web Service, build `npm install`, start `npm start`), controls, where to change numbers (`shared/data.js`), rooms (`shared/rooms.js`) and art (`client/assets/`), how to run tests.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:** `npm test` all pass; headless browser plays a test game forced into the shop (server env `DEBUG_SKIP_TO_SHOP=1` jumps straight to `phase 'shop'` with 150 gold) — buying Guard Mail drops gold to 90 and shows Owned; both Ready → end screen.
- [ ] **Step 3:** Commit `feat: shop and end screens, README`; zip the project without `node_modules` for delivery.
