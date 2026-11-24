# Dungeon Crew Polish (Stage Wins, Shop Timer, Sound) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Results screen with stars, stats and badges after each floor; a 45 s shop timer; code-made sound effects with a volume control.

**Architecture:** The server counts per-player stats and works out stars/badges (same numbers for everyone), runs the shop timer, and adds an `attack` event. The browser shows the results overlay, room-clear flourish, shop countdown, and plays Web Audio sounds from the events it already receives.

**Tech Stack:** Node, Phaser 3, Web Audio API, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-24-dungeon-crew-polish-design.md`

## Global Constraints

- Stars: 1 + (nobody downed this floor) + (floor time ≤ target). Targets 240 / 300 / 360 / 300 s for Floors 1–4 (`floor.targetTime`).
- Badges: `mvp` = most damage (first player on ties); `lifesaver` = most revives, only if > 0; `untouchable` = every player with 0 downs.
- Results card time 7 s (`CARD_TIME.floorclear = 7`).
- Shop: `SHOP_TIME = 45` s; red + ticking from 10 s; at 0 the next floor starts for everyone (same as all ready).
- Volume default 0.7, saved in `localStorage` key `dc-volume` / `dc-muted`; same sound at most 4 times per 100 ms.
- Commit trailer on every commit.

## Review Focus

1. The shop timer must keep running even with nobody pressing anything, and must not run while the game is in another phase. (Task 2 test.)
2. A player who leaves during the shop must not stop the timer from starting the next floor. (Task 2 test.)
3. Stats reset each floor but the run totals keep adding up. (Task 1 test.)
4. The browser must not throw when Web Audio is blocked until the first click. (Task 4: sounds are queued only after `resume()`; checked in the headless smoke with no clicks.)
5. The victory screen still works when a player has 0 of everything. (Task 3 smoke with run stats.)

---

### Task 1: Stats, stars and badges (server)

**Files:** Modify `server/game.js`, `shared/rooms.js` (`targetTime` per floor), `server/heroes.js` (`attack` event; revive credit). Test `test/results.test.js`.

**Interfaces — Produces:**
- `p.stats` and `p.runStats`: `{ kills, damage, gold, downs, revives }` (stats reset in `startFloor`).
- `game.revive(p, fraction, byId = null)` credits `byId`'s revives.
- `game.floorResults() -> { floorIndex, floorName, time, targetTime, stars, starReasons: { cleared:true, noDowns:bool, fast:bool }, players: [{ id, name, heroClass, color, level, ...stats, badges: string[] }] }`.
- `game.runResults() -> { time, players: [{ id, name, heroClass, color, level, ...runStats, badges }] }`.
- On the last room's clear: event `{ type: 'floorresults', results: floorResults() }` before the card.
- `shopState()` adds `results` (last floor results) and, when `final`, `run: runResults()`.
- `heroes.basicAttack` emits `{ type: 'attack', by, kind: heroClass }`.

- [ ] Tests: `kills, damage and gold earned are counted for the player who landed the hit`; `downs and revives are counted, feathers and holding E both credit the reviver`; `stats reset each floor, run totals keep adding up`; `three stars for a fast floor with nobody downed`; `one star when someone was downed and the floor was slow`; `MVP goes to the most damage, Lifesaver only appears if someone revived, Untouchable for everyone never downed`; `clearing the last room sends the results with the card`.
- [ ] Run → FAIL; implement; `npm test` → pass; commit `feat: per-floor stats, stars and badges`.

### Task 2: Shop timer (server)

**Files:** Modify `server/shop.js`, `server/game.js`, `server/hub.js`. Test `test/shoptimer.test.js`.

**Interfaces — Produces:** `game.enterShop()` sets `phase='shop'`, `shopEndsAt = time + SHOP_TIME`, emits `phase`; `game.tick` in phase `shop` advances time and calls `shop.timeUp(game)` at the deadline; `shop.startNextFloor(game)` (shared by all-ready and time-up); `shopState().timeLeft` (seconds, 1 decimal). `hub.tick` calls `game.tick` in phase `shop` too and sends `shop:state` once per second while the shop is open.

- [ ] Tests: `the shop gives 45 seconds`; `when time runs out the next floor starts even if nobody is ready`; `everyone ready still starts right away`; `a player leaving doesn't stop the timer`; `the timer doesn't run while playing`; `purchases are kept when the timer ends`.
- [ ] Run → FAIL; implement; `npm test` → pass; commit `feat: 45 second shop timer`.

### Task 3: Results screen, room-clear flourish, shop countdown (browser)

**Files:** Create `client/js/ui/results.js`. Modify `client/index.html`, `client/css/style.css`, `client/js/ui/hud.js` (no small card for `floorclear` when results are showing), `client/js/game/scene.js` (on `floorresults` → `Results.show(results)`; `roomclear` banner + door bars sliding up over 0.6 s + gold bursts on door tiles), `client/js/ui/shop.js` (countdown bar, red under 10 s; victory uses `state.run` stats and badges).

- Results overlay: title "FLOOR N CLEARED!", floor name, stars popping in at 0.6 s / 1.0 s / 1.4 s (empty star outline when not earned, with its reason: "Nobody went down" / "Under m:ss"), player cards counting up over 1.2 s, badge chips, confetti (CSS animated pieces), auto-hides after 7 s.
- [ ] `node --check`; `npm test`; headless: results overlay screenshot (inject a `floorresults` event), shop with timer, room-clear banner; `errors: []`.
- [ ] Commit `feat: results screen, room clear flourish and shop countdown`.

### Task 4: Sound effects

**Files:** Create `client/js/audio.js` (`window.Sound = { play(name), setVolume(v), setMuted(b), volume, muted, unlock() }`), modify `client/index.html` (script before game scripts; volume control in menu and pause card), `client/js/game/scene.js` (event → sound map), `client/js/ui/*.js` (click, buy, ready, countdown ticks, stars, fanfare), `client/css/style.css`.

- Synth: oscillator + noise buffer voices with envelopes, pitch slides and a lowpass; one master gain = volume.
- Sound names (≥30): `swing, arrow, bolt, bash, taunt, arrowRain, roll, fireball, heal, hit, hurt, kill, bossKill, slimeSplit, batScreech, bones, puff, roar, slam, sweep, breath, gust, meteor, spike, crumble, fall, geyser, jet, lava, bridge, coin, buy, ready, levelup, downed, revive, roomClear, fanfare, star, tick, victory, click`.
- [ ] `node --check`; headless smoke with `Sound` debug counter (`Sound.played` count by name) showing sounds fire on gameplay events, `errors: []`, no clicks needed for the page to work.
- [ ] Commit `feat: sound effects and volume control`.

### Task 5: Finish

- [ ] README notes (shop timer, sound, volume); final self-review; `npm test`; merge to `main` and push (Vercel + Cloudflare redeploy on their own); check the live link loads.
