# Dungeon Crew — New Art & Body Animation (design)

## Why
Drei: the heroes and monsters look plain (16×16, one picture each, slid around the
floor). Every walk, attack and skill should show the body moving. Approved after the
preview page (Knight + Gloop): "That's awesome. Let's build."

## Goals
- All 5 heroes (4 player colors each) and every monster/boss redrawn with about twice
  the detail, same size on screen as today.
- Real frames for every action:
  - heroes: idle, walk, attack, Q skill, Space skill, hurt, down, roll (dodge)
  - monsters: idle, walk, hurt, death, plus a pose for each special state the server
    already sends (squish, leap, screech, swoop, draw, swell, shimmer, storm, raise,
    ring, flap, fly, tail, breathe, airborne)
- Monsters play a death animation instead of vanishing.

## Non-goals
- No gameplay, hit-size or balance changes. No new monsters.
- Heroes only face left/right (flip), as today — no up/down facing sets.

## Anti-goals
- Blurry or uneven pixels (only whole-number scaling in the game).
- A slower game: frames are drawn once into sprite sheets, never per game frame.

## Approach (picked by Drei: option 2)
1. Hand-draw every frame at 32×32 — rejected: hundreds of frames, fewer moves each.
2. **Draw each character as parts (head, body, arms, legs, weapon…) and pose the parts
   into real pixel frames with a small engine.** Every action gets body movement; art
   stays crisp. ← chosen
3. Keep old art and only add code motion (bob/squash) — rejected: still plain.

## Design
- `shared/rig.js` — the engine from the preview: parts as letter rows + palette,
  parent/child parts, pose = move/turn/stretch/show per part, smooth turning (EPX),
  auto dark outline per part, `rigid` parts that follow but don't stretch.
- `shared/art/<name>.js` — one file per character: parts, rig, animations, palette.
  `shared/art/index.js` lists them and gives each sprite sheet's frame list.
- Frame sizes: heroes and normal monsters 32×32; bosses bigger (Gloop Mother 64,
  Spore Queen 64, Golem 48, Crown King 64, Dragon 96). All drawn at 2× in the game.
  Mini Gloop uses the Gloop sheet at a smaller in-game scale; Half Mother uses the
  Mother sheet.
- `npm run sprites` writes `client/assets/<key>-sheet.png` (all frames in one row) and
  keeps `<key>.png` as a single portrait frame, so the lobby/shop/results pictures keep
  working.
- Client: loads sheets as Phaser spritesheets, makes one Phaser animation per
  (sheet, action), and each game frame picks the action from the snapshot:
  downed/dead > one-shot (attack, cast, hurt) > server state pose > walk if moving >
  idle. `attack` and `cast` events start the one-shots; a `kill` event leaves a
  short-lived body that plays the death animation and fades.
- Existing tints/flashes stay; the old stretch tricks are replaced by the new poses
  where an animation covers them.

## Left to the builder
Exact poses and pixel art per character; frame rates; which state uses which pose.
