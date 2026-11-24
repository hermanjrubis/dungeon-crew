# Loot Drops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** monsters randomly drop coins, hearts, potions and feathers that the first hero to touch takes.
**Architecture:** new `server/loot.js` (roll + update + snapshot), called from `Game.killEnemy`, `Game.tick`, `Game.loadRoom`, `Game.snapshot`; loot table in `shared/data.js` as `LOOT`; client draws `snap.loot` and reacts to a `pickup` event.
**Tech Stack:** Node, node:test, Phaser 3.90.
**Spec:** docs/superpowers/specs/2026-11-24-loot-drops-design.md

## Global Constraints
- Chances: coins .35, heart .12, potion .06, feather .02; boss: 5–8 coin piles + 1 potion. Life 12 s, blink last 3 s. Heart heals 20% maxHp. Pickup reach 30 px.
- Uses `game.rng()` only (tests are seeded).

## Review Focus
- Two heroes on the same drop in one tick: only one gets it.
- Downed hero standing on loot: nothing happens.
- Room change mid-loot: loot gone, no pickup on the new room.
- Summoned minions (summonedBy) and noReward kills: no drops.
- Heart picked at full HP: still consumed (first-come rule), heals 0.

### Task 1: server loot (`server/loot.js`, `shared/data.js`, `server/game.js`, `test/loot.test.js`)
Produces: `loot.roll(game, enemy)`, `loot.update(game)`, `loot.snapshot(game)`; `data.LOOT`; event `{type:'pickup', kind, playerId, amount, x, y}`; snapshot field `loot: [{id, kind, x, y, until}]`.
- [ ] Tests: drop chances via stubbed rng (coins/heart/potion/feather/none), boss burst 5–8 coins + potion, minion no drop, first-come single winner, downed can't pick, expiry at 12 s, loadRoom clears, heart heals 20%, coins add stat gold.
- [ ] Watch fail → implement → `npm test` green → commit.

### Task 2: client (`shared/icons.js` heart, `client/js/game/scene.js`, sound)
- [ ] Icon test for `heart`; draw loot sprites from `snap.loot` (bob, blink when `until - t < 3`), pop-in tween, float text + sound on `pickup` event.
- [ ] Smoke on floor 1 + boss room, screenshot, `npm test`, commit, push.
