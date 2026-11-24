# Dungeon Crew — Music, Instant Attack Sounds, Stonewarden and Engineer Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two new heroes (Stonewarden tank, Engineer builder), background music in the game, and attack/skill sounds that play instantly.

**Architecture:** Heroes stay data in `shared/data.js` plus their skills in `server/heroes.js` (the server decides all hits). New projectiles/zones reuse the existing projectile and zone loops. The browser gets sprites, character-select text, effects and sounds. Music (`client/js/music.js`, already written) is driven by a small "director" that picks the song from the current screen/floor/boss.

**Tech Stack:** Node, Phaser 3, Web Audio, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-24-dungeon-crew-music-heroes-design.md`

## Global Constraints

- Class ids: `warden` (Stonewarden), `engineer`. `CLASSES = ['knight','archer','mage','warden','engineer']`.
- Stonewarden: hp 170, speed 125, baseDmg 11, starter Cracked Sling +4; attack `rock` (speed 380, ttl 0.75, cd 0.7, r 9); Q Boulder Toss cd 8 (speed 300, ttl 2, r 20, dmg 22, pierces, push 48, hits each monster once); Space Quake Stomp cd 12 (radius 96, dmg 14, stun 1.2 s; bosses slowed 50% for 2 s instead); passive Thick Skin = damage taken ×0.7 (after defense, min 1, includes poison/burn/lava), Wing Gust pushes him half as far.
- Engineer: hp 95, speed 175, baseDmg 9, starter Rusty Wrench +3; attack `swing` (arc 80, range 56, cd 0.45); Q Turret cd 12 (lasts 10 s, shoots the nearest monster within 300 px every 0.6 s, shot dmg 7 + half the Engineer's weapon bonus, one turret per Engineer); Space Mine cd 6 (arms after 0.5 s, triggers when a walking monster comes within 28 px, blast radius 72, dmg 30, lasts 20 s, at most 2 per Engineer); passive Scrapper = +10% gold (rounded) from every kill reward.
- Shop weapons: warden Iron Sling / Granite Sling / Magma Sling; engineer Steel Wrench / Arc Wrench / Forgemaster Wrench. Dragon trophies: Mountainheart, Thunder Gauntlet.
- Music volume default 0.4, effects 0.7; one Mute mutes both.
- Commit trailer on every commit.

## Review Focus

1. A Boulder must not hit the same monster twice. (Task 1 test.)
2. A turret or mine left over when the room changes must disappear (zones reset per room). (Task 1 test.)
3. Thick Skin must never turn a hit into 0 damage. (Task 1 test.)
4. Two Engineers each keep their own turret. (Task 1 test.)
5. Music must not restart in a loop after the one-shot Victory song ends. (Task 4: director only calls `Music.play` when the wanted song changes; checked in the headless smoke.)

---

### Task 1: Stonewarden and Engineer on the server

**Files:** Modify `shared/data.js`, `server/heroes.js`, `server/game.js` (Thick Skin in `damagePlayer` and `poisonPlayer`; Scrapper in `killEnemy`), `server/dragon.js` (gust), `server/shop.js`/data shop weapons. Test `test/newheroes.test.js`; update class-count expectations.

- [ ] Tests: `the lobby offers five heroes`; `rock throw shoots a rock`; `a boulder rolls through monsters, hitting each once`; `quake stomp stuns monsters nearby and only slows bosses`; `thick skin takes 30% less damage, never 0`; `thick skin also cuts poison and lava`; `wing gust pushes the Stonewarden half as far`; `the engineer's wrench swings`; `a turret shoots the nearest monster for 10 s`; `a new turret replaces the old one, but two engineers keep one each`; `mines arm, then blow up when a monster steps close`; `at most two mines`; `turrets and mines vanish when the room changes`; `scrapper gives the engineer 10% more gold`; `the shops sell the new heroes' weapons`.
- [ ] Run → FAIL; implement; `npm test` → pass; commit `feat: stonewarden and engineer heroes`.

### Task 2: The new heroes in the browser

**Files:** `shared/sprites.js` (maps `warden`, `engineer`, palettes; spriteFiles over all CLASSES), `test/sprites.test.js`, `client/js/ui/lobby.js` (INFO, STAT_VALUES), `client/js/ui/hud.js` (attack names from a map), `client/js/game/scene.js` (shots `rock`, `boulder`, `turretShot`; zones `turret`, `mine`, `quake`; cast effects `boulder`, `quake`, `turret`, `mine`), `client/js/ui/shop.js` (trophies), CSS if the hero list needs to fit 5.
- [ ] `npm run sprites`; `npm test`; headless: character select with 5 heroes, a game as each new hero using Q and Space; `errors: []`; commit `feat: new heroes in the browser`.

### Task 3: Sounds for every attack and skill, instantly

**Files:** `client/js/audio.js` (recipes `rock, boulder, quake, wrench, turret, turretShot, mine, mineBoom`; `play(name, { vol })`; expose `Sound.ctx`), `client/js/game/scene.js` (local sound when *I* attack/use Q/Space and the cooldown/mana allows; skip my own server `attack`/`cast` echoes; teammates' at 60%).
- [ ] Headless: holding attack as the Mage plays `bolt` without any server event (count `Sound.played.bolt` with the server events blocked is not needed — check it fires within 100 ms of the press); all recipes play; `errors: []`; commit `feat: instant attack and skill sounds`.

### Task 4: Music in the game

**Files:** `client/index.html` (load `music.js`), `client/js/audio.js` (attach Music on unlock; controls get a Music slider and an Effects slider, one Mute for both), `client/js/main.js` (director: menu/lobby → `menu`; shop → `shop`; game → floor song by `floorIndex` (`cellar, caverns, forge, roost`), `boss` while a boss is alive or the boss card is up, `victory` while the results screen shows; end screen → `victory`).
- [ ] Headless: the director picks `menu` on the menu, the floor song in game, `boss` with `DEBUG_ROOM=3`, `shop` with `DEBUG_SKIP_TO_SHOP`; `Music.play` called once per change; `errors: []`; commit `feat: background music in the game`.

### Task 5: Finish

- [ ] README; final self-review; `npm test`; push to `main`; check the live link (5 heroes, music) after Vercel and Cloudflare redeploy.
