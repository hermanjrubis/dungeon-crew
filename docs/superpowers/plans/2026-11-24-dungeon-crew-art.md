# New Art & Body Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every hero and monster gets detailed part-based pixel art with real frames for every action.
**Architecture:** `shared/rig.js` poses parts into frames; `shared/art/*` holds each character; `tools/make-sprites.js` writes sprite sheets; the Phaser scene picks an animation per entity from the snapshot + events.
**Tech Stack:** vanilla JS (UMD modules shared by Node + browser), Phaser 3, node:test.
**Spec:** docs/superpowers/specs/2026-11-24-dungeon-crew-art-design.md

## Global Constraints
- Same on-screen size as today; whole-number scaling only (frames drawn at 2×).
- No server/gameplay changes.
- `<key>.png` portraits keep their names (lobby, shop, results, HUD, favicon use them).

## Review Focus
- An entity whose animation key is missing must not crash the scene (fall back to idle).
- One-shot animations must not get stuck (e.g. attack started while downed).
- Death bodies must be cleaned up (no leak across rooms/floors).
- Flip + rotation for downed heroes: the old `setAngle(90)` must not double up with the new down pose.
- Mini Gloop / Half Mother scaling must keep whole pixels (scale 1 for 32-frame mini = 32px; mother 64→ drawn at 1.5? → use dedicated scale that stays whole).

### Task 1: Rig engine
- Create `shared/rig.js` (from preview) and `test/rig.test.js`: outline appears around a 1-pixel part; hidden parts don't draw unless `show`; rigid child keeps its size when the parent stretches; frame size = rig size.
- Run `node --test test/rig.test.js` → pass. Commit.

### Task 2: Art registry + sprite sheets
- `shared/art/index.js`: `CHARACTERS` (name → art module), `sheetFiles()` → [{ key, file, art, palette, frames:[{anim,index,pose}], anims:{name:{start,count,fps,loop}} }], `animKey(sheet, anim)`.
- `shared/art/knight.js`, `shared/art/gloop.js` (from preview).
- `tools/make-sprites.js` writes `<key>-sheet.png` + `<key>.png` portrait.
- `test/art.test.js`: every hero has idle/walk/attack/q/space/hurt/down/roll; every enemy type in `ENEMIES` maps to a sheet with idle/walk/hurt/death; frames render without throwing and are the declared size.
- Commit.

### Task 3: Scene uses sheets
- `preload` loads spritesheets; `create` makes animations; `drawEntities` picks action per entity; `attack`/`cast` events → one-shot; `kill` → death body. Headless check: no errors, hero sprite plays walk while moving.
- Commit.

### Task 4: Hero art — Archer, Mage, Warden, Engineer
### Task 5: Monster art — Bat, Bone Archer + Bones, Sporecap + Seed, Gloop Mother
### Task 6: Boss art — Spore Queen, Golem, Crown King, Dragon
Each: art file, contact sheet checked by eye, `npm test`, commit.

### Task 7: Finish
- Preview page updated with every character; full test run; headless smoke; push to `main`.
