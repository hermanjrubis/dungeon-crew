# Dungeon Crew — Slice 1 Design

Date: 2026-11-23
Status: draft, waiting for Drei's approval
Mockups: the "Co-op Dungeon Crawler — Mockups" canvas (screens, monsters, floors, shop, sets, bosses, items, character select)

## Intent

Drei's group (4 people, 2 developers) has a class task to build a multiplayer browser game that anyone can play. They chose a co-op top-down dungeon crawler: 2–4 friends join a room by code, pick a hero, and fight through floors of monsters, hazards and bosses, collecting gold to buy gear between floors.

The game is too big to build in one go, so it is built in slices. **Slice 1** is the smallest version that already feels like the real game: friends can join from their own browsers, pick heroes, clear Floor 1 together, beat its boss, and spend gold in the shop. Every later slice (Floors 2–4, more bosses, the dragon, the full item list) builds on top of it.

Success for Slice 1: two people on different computers open a link, join the same room, play through Floor 1 together without the game falling out of sync, and reach the shop.

## Goals (Slice 1)

1. **Main menu** — enter a name, create a room, or join with a 4-letter code.
2. **Lobby + character select** — up to 4 players per room. Pick Knight, Archer or Mage and a color (orange, blue, teal, pink; each color used once per room). "Lock in"; the host starts when everyone is locked in.
3. **Three playable heroes**, each with a basic attack and two skills (passives come in a later slice):
   - Knight — HP 120, sword swing (close arc). Q Shield Bash (push back + 1s stun, 6s). Space Taunt (nearby enemies target you for 3s, 12s).
   - Archer — HP 80, arrow shot. Q Arrow Rain (damage circle for 2s, 10s). Space Dodge Roll (short dash, can't be hit, 4s).
   - Mage — HP 70, magic bolt, uses mana. Q Fireball (small explosion, 3s). Space Heal Circle (teammates inside heal 30 HP over 3s, 12s).
4. **Floor 1: Sunken Cellar** — 4 rooms in a row: 3 combat rooms + 1 boss room. A room's exit door unlocks when all its enemies are dead.
5. **Monsters with their skills** —
   - Gloop: hops toward closest player; Bounce (1s squish, then leap 3 tiles); Split on death into 2 Mini Gloops (8 HP).
   - Skitterbat: flies over pits; Swoop (dash bite, then retreat 2s); Screech (slows players within 3 tiles by 30% for 2s).
6. **Hazards** — spike traps (rattle 0.5s, up for 1s every 3s, 10 dmg), crumbling floor (breaks 1s after being stepped on; falling = back to room door, −15 HP), puddles (40% slower). Hazards hurt monsters too.
7. **Boss: Gloop Mother** — Belly Flop (shadow 1.5s, then lands), Brood (2 Gloops every 12s), Slime Trail (slowing slime). At half HP she splits into two smaller Mothers (60 HP each). HP +50% per extra player.
8. **Co-op rules** — gold from kills goes to everyone. A player at 0 HP is *downed*; a teammate holds E next to them for 3s to revive. If everyone is downed, the room resets (enemies back, players at the room door with full HP).
9. **Progress** — XP from kills, levels 1–5 (each level: +10 max HP, +2 damage). HUD shows HP, XP/level, gold, teammates' HP, room "x of 4", and the hotbar.
10. **Camp shop after Floor 1** — Cellar Guard set (Iron Helm, Guard Mail, Wader Boots), the class weapon upgrade, Health Potion, Revive Feather. Prices and stats from the mockups. Buying applies the stats right away. "Ready" when everyone is done → end screen "Floor 2 coming soon".
11. **Every warning is visible** — each skill or hazard that hurts shows its tell (squish, shadow, glow, rattle) before it lands.

## Non-goals (later slices)

Floors 2–4, the other bosses and the dragon, the full weapon/ring/consumable list, the inventory screen, hidden chests, Hard Mode, passives, chat, touch controls for phones, saving progress or accounts, sound.

## Anti-goals (failure even if it "works")

- Players see different things (an enemy dead on one screen, alive on another).
- Code the two student developers can't read, explain in their presentation, or extend. No TypeScript, no bundler, no framework beyond Phaser.
- A game that only works on Claude's machine: it must run with `npm install` and `npm start` on a normal laptop.

## Constraints

- Vanilla JavaScript everywhere. Node.js 18+.
- Client: Phaser 3, loaded as a plain script. No build step.
- Server: Node.js with Express (serves the client files) and Socket.IO (live connection).
- One process: the same server serves the game page and runs the rooms, so hosting is a single service.
- Art: placeholder pixel art generated from the mockup sprites into PNG files. The art team can replace any PNG with one of the same name and size.

## Approaches

1. **Phaser + Node.js server (chosen).** The server runs the real game; browsers send key presses and draw what the server says. Everyone sees the same thing, and cheating or desync is hard. Needs a hosted server for online play (Render/Railway or similar); on one Wi-Fi it can run on a laptop.
2. **Peer-to-peer (host's browser runs the game).** Nothing to host, but often blocked on school/campus Wi-Fi, and the game ends if the host leaves.
3. **Single-player first, multiplayer later.** Fastest first demo, but adding multiplayer afterwards usually means rewriting most of the game.

Drei picked approach 1.

## How it works (decided)

- **Server is the referee.** Rooms, movement, collisions, enemy AI, hazards, damage, gold, XP and the shop all run on the server at 20 updates per second.
- **Browsers send input, not results.** Each client sends its movement keys, aim direction, and attack/skill presses. The server answers with snapshots of everything in the room.
- **Smooth movement.** Your own hero moves instantly on your screen and is gently corrected to the server's position; other players and enemies are smoothed between snapshots.
- **Shared rules file.** Tile collision and the room maps live in a shared folder used by both server and client, so they can't disagree.
- **Rooms as text maps.** Each dungeon room is a grid of characters (like the canvas maps: `w` wall, `f` floor, `s` spikes, `x` cracked floor, `p` pit, `u` puddle, `d` door), so new rooms are easy to add by editing text.
- **Game data in plain files.** Hero, monster, item and shop numbers live in data files, so balancing is editing numbers, not code.

## Calls Claude made (check these)

- All three heroes are playable in Slice 1, not just the Knight, because the character select screen would feel broken otherwise.
- Rooms lock once the host starts; nobody can join mid-floor in Slice 1.
- If a player disconnects, their hero leaves the game; if the host leaves, the next player becomes host.
- Mage mana: 100 max, refills over time; each skill costs mana. Numbers tuned during building.
- Hotbar: 1 = Health Potion, 2 = Revive Feather (used on the nearest downed teammate).
- Shop weapon upgrades: Iron Sword / Hunter's Bow / Oak Staff, +8 damage instead of the starter's.

## Left to the builder

Exact folder layout, room layouts, art sizes (tiles about 48 px on a 1280×720 view, scaled to fit the window), AI details within the behaviors above, how many enemies per room (rising from ~4 to ~7), and tests: game rules are tested with automated tests, plus a test that connects two fake players to a real server and plays through a room.

## Delivery

A project folder (zip) with a README: how to run it, how to play with friends on the same Wi-Fi, and how to put it online.
