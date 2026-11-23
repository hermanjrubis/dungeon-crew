# Dungeon Crew — Slice 2 Design

Date: 2026-11-23
Status: draft, waiting for Drei's approval
Builds on: Slice 1 (`2026-11-23-dungeon-crew-slice-1-design.md`), the mockups canvas (Floors & hazards, Monsters, Bosses, Armor sets)

## Intent

Drei played Floor 1 through and wants two things:

1. **Traps in different places every game.** Playing again shouldn't mean the spikes are always in the same spot. The room shapes (outer walls, entrance, exit door) stay; what moves is the *stuff inside*: spike traps, cracked floor and pits, puddles, poison pools, pillars, and where monsters start.
2. **The next stage: Floor 2, the Fungal Caverns**, played right after the Floor 1 shop, with the same team, levels, gold and gear.

Success: two games in a row have visibly different trap layouts on every non-boss room; after the Floor 1 shop the team walks into Floor 2, beats the Spore Queen, and reaches a second shop.

## Goals

### A. Random trap layouts (all floors)

1. Each non-boss room is a **recipe**: its fixed shape plus a list of what to scatter in it, for example "3 spike patches (2×2), 1 pit ringed with cracked floor, 2 puddles, 2–4 pillars, 4 Gloops".
2. The server builds every room when a game starts, using random placement with rules:
   - nothing within 2 tiles of the entrance or the exit door;
   - things don't overlap;
   - monsters don't start on a hazard and start at least 5 tiles from the entrance;
   - there is always a path from the entrance to the door that never crosses a pit or cracked floor (checked by code; if a try fails, it tries again, and after 50 tries falls back to a hand-made layout).
3. **Retrying a room keeps the same layout** (fair to learn); **a new game gets new layouts.**
4. Boss rooms stay hand-made so boss fights are always fair.
5. The server sends each room's layout to the browsers, so every player sees the same room.

### B. Floor 2: Fungal Caverns

4 rooms: 3 random rooms (bats + archers; archers + Sporecaps; everything plus a dark zone) and the hand-made Spore Queen lair. Same title cards as Floor 1 ("Floor 2 · Fungal Caverns").

**Monsters** (numbers from the mockups):
- **Bone Archer** — HP 30, damage 8. Stays about 5 tiles from its target, backs away when you get close.
  - *Volley* (every 5 s): draws back for 1 s, then fires 3 arrows in a fan. Arrows hit players; the Archer's Dodge Roll makes you safe from them.
  - *Rattle Back*: when killed it collapses into bones and rebuilds itself 5 s later — unless a player stands on the bones, which destroys them for good. The room isn't clear while bones remain.
- **Sporecap** — HP 40, doesn't move.
  - *Poison Puff* (every 4 s): its cap swells when a player is within 2 tiles, then it releases a poison cloud for 3 s (3 damage per second inside).
  - *Spore Seed* (every 15 s): spits a seed that grows into a new Sporecap after 10 s unless someone breaks it (1 hit). At most 6 Sporecaps per room.
- **Skitterbat** — as on Floor 1.

**Hazards:**
- **Poison pools** — 4 damage per second while you stand in one.
- **Falling stalactites** — every few seconds a shadow grows on the floor near a random player for 1 s, then a rock lands: 15 damage. Hits monsters too.
- **Dark zones** — inside them you only see about 3 tiles around you. Unlit torches stand in the dark; a player who presses E next to one lights it, and it lights its area for the whole team.

**Poison** is a new kind of damage. The Floor 1 Cellar Guard set bonus (all 3 pieces) now does what it says: poison damage −50%.

**Boss: Spore Queen** — HP 400 (+50% per extra player), damage 12.
- *Teleport* (every 8 s): shimmers for 0.6 s, then reappears somewhere else in her lair.
- *Spore Storm*: 3 safe circles glow on the floor for 2 s, then everywhere else fills with spores: 15 damage to anyone outside a circle.
- *Vine Grab*: a ring appears under a player; 1 s later vines hold them in place for 1.5 s (they can still attack).
- *Royal Guard*: grows 2 Sporecaps next to her.
- *Phase 2* (half HP): the lair goes dark. Only her glowing spots and lit torches show where things are. Four torches stand in the lair.
- Pays 70 gold and 150 XP to everyone.

### C. Between floors

- "Ready for Floor 2" in the Floor 1 shop starts Floor 2. Everyone starts it at full HP and keeps level, gold, gear, potions and feathers.
- After Floor 2: a **second camp shop** with the Forgewalker set (Copper Helm 80g +20 HP, Forge Plate 110g +6 defense, Ashstep Boots 90g +15% speed), the tier-2 weapon (Steel Sword / Longbow / Crystal Staff, 120g, +14 damage), potions and feathers. Then the end screen: "Floor 2 cleared! Floor 3 coming soon."
- Levels go up to 8 now (XP needed: 0, 50, 120, 220, 350, 500, 700, 950).
- New rewards: Bone Archer 15 XP / 5–8 gold, Sporecap 12 XP / 4–6 gold, seeds and boss-grown Sporecaps nothing.

## Non-goals

Floors 3–4 and the dragon, item drops (Spore Staff, Mana Potion), the inventory screen, hidden chests, hero passives (Eagle Eye etc.), sound, chat, phone controls.

## Anti-goals

- A random room that can't be finished (door unreachable, a monster stuck in a wall).
- Players seeing different layouts.
- Floor 2 breaking Floor 1: every Slice 1 test keeps passing.

## Approaches (for the random layouts)

1. **Room generator** — everything inside every room random each game. Most variety, least "designed".
2. **Several hand-made layouts per room, picked at random** — designed feel, but repeats after a few games and needs many drawings.
3. **Same room shapes, traps and monsters placed at random (chosen)** — Drei asked for exactly this: walls stay familiar, trap positions change every game.

## How it works (decided)

- Room recipes live in `shared/rooms.js` as plain data (shape rows + "what to scatter"), so the group can tune them.
- The generator is server code with automated tests: it builds thousands of rooms in a test and checks every rule above on each one.
- Floors, their names, room names, shop items and end-of-floor shops are data, so Floor 3 later is mostly adding data.
- Enemy arrows, poison and darkness follow the Slice 1 rule: the server decides, the browser draws.

## Calls Claude made (check these)

- Pillars (small wall blocks) are part of the random obstacles, so room shapes feel different too.
- Bone Archer bones block the room from clearing until destroyed or rebuilt-and-killed.
- Spore Storm is one 15-damage hit (not lingering poison), so it's readable.
- After the Floor 2 shop the game ends ("Floor 3 coming soon"), like Floor 1 did before.
- Dark zones: everyone sees 3 tiles around themselves; each player's screen shows their own light, plus lit torches.

## Left to the builder

Exact recipe contents per room, speeds for the Archer and Queen, how many stalactites fall, darkness drawing details, and the effects for every new skill (same style as Slice 1's effects).
