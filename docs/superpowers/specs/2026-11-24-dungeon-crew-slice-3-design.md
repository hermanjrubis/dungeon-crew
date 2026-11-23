# Dungeon Crew — Slice 3 Design (Floor 3 and Floor 4)

Date: 2026-11-24
Status: draft, waiting for Drei's approval
Builds on: Slice 2 (`2026-11-23-dungeon-crew-slice-2-design.md`) and the mockups canvas (Floors & hazards, Monsters, Bosses, Armor sets)

## Intent

Drei asked for the next stages. The game should now run all the way through: Floor 1 → shop → Floor 2 → shop → **Floor 3, the Molten Forge** → shop → **Floor 4, Ashmaw the Ember Dragon** → a victory screen. That gives the group a complete game to present.

Success: a team can start a game, clear all four floors with the same heroes, beat the dragon and see "Victory". Every hazard and boss attack has a warning players can learn, like the first two floors.

## Goals

### A. Floor 3: Molten Forge

4 rooms: 3 random rooms (same recipe system as Floor 2) and a hand-made boss hall. Title card "Floor 3 · Molten Forge". Mockup tagline: "The room itself is trying to burn you."

**Hazards** (numbers from the mockups):
- **Burning**, a new kind of damage: 3 per second for 3 s. Getting burned again restarts the timer (it doesn't stack).
- **Lava geysers.** The vent glows orange for 1.5 s, then lava erupts for 2 s: 30 damage plus burning. Vents take turns so a room never erupts all at once.
- **Lava river with a moving bridge.** A river 2 tiles wide crosses the room. A stone bridge sits over it and slides to a new spot every 4 s. It flickers for 1 s before it moves, and it carries anyone standing on it. Stepping into lava costs 50 damage, and you reappear at the room's entrance.
- **Flame jets.** Nozzles sit in the walls. They hiss for 0.5 s, then fire shoots across the room until it hits a wall: 15 damage. They fire every 3 s in a set pattern: two groups that take turns, so there's always a safe lane.
- Ground monsters treat lava as a wall. Skitterbats fly over it.

**Monsters:**
- **Rubble Golem.** HP 120, damage 20, very slow.
  - *Ground Slam* (every 5 s): raises its fists for 1 s, then hits everyone within 2 tiles.
  - *Stone Skin*: takes half damage from the front (the side facing its target). One player keeps it busy while another hits its back.
  - Gives 25 XP and 10–15 gold.
- Gloops, Skitterbats and Bone Archers also appear, so earlier monsters mix with the new ones.

**Boss: The Hollow King.** HP 600 (+150 per extra player), damage 25, normal speed.
- *Royal Sweep* (every 4 s): raises his sword for 1 s, then slashes a wide arc in front of him.
- *Summon Court* (every 20 s): calls 3 Gloops in from the room's corners.
- *Phase 2* (half HP): his crown flares and he moves faster. He adds *Shadow Ring* (every 6 s): glows for 1.5 s, then fires 12 bolts outward. Players dodge through the gaps.
- Pays 100 gold and 200 XP to everyone.

### B. Shop after Floor 3: Hollow Crown Set

- Crown Helm: 150g, +30 max HP
- Royal Plate: 200g, +9 defense
- Shadow Greaves: 160g, +20% move speed
- Full set bonus: dragon fire damage −40%, and the whole team deals +10% damage while the wearer is alive. Two wearers don't stack it.
- Tier-3 weapon, 200g, +22 damage: Ember Blade / Shadow Bow / King's Scepter
- Potions and feathers as before

The **Forgewalker set bonus** (Floor 2 shop) now does what the mockup says: lava geysers deal 30% less, and burning lasts 1 s instead of 3 s.

### C. Floor 4: Dragon's Roost

2 rooms:
1. **Ashen Stair**, one random warm-up room: Golems, Archers, Bats, geysers and flame jets.
2. **Dragon's Roost**, hand-made: a stone island in a sea of lava. The island has a solid center and an outer ring of platforms that can crumble.

**Final boss: Ashmaw, the Ember Dragon.** HP 1,200 (+300 per extra player), damage 35. Large sprite.
- *Fire Breath*: rears back while its throat glows for 1.5 s, then sweeps a cone of fire. 35 damage plus burning.
- *Wing Gust*: flaps twice, then blows every player 4 tiles away from itself, toward the lava edge.
- *Tail Swipe*: if anyone stands behind it, the tail glows, then it swipes a half circle behind itself. 25 damage.
- *Meteor Rain*: flies up out of reach. Red circles mark the floor for 1.5 s, then fireballs land (30 damage each).
- *Phase 2* (60% HP): it stays in the sky. Only ranged attacks hit it: arrows, Arrow Rain, bolts and Fireball. After each Meteor Rain it lands and is stunned for 3 s. That's the Knight's window to hit it.
- *Phase 3* (25% HP): every 15 s, the outermost ring of platforms cracks for 2 s and falls into the lava, so the arena shrinks. This happens at most 3 times. The center never falls.
- On defeat: the **Victory screen**. It shows "Ashmaw is defeated!", the team's heroes with their levels, total gold, time played, the mockup's dragon loot as trophies (Dragonfang Sword / Emberstorm Bow / Wyrmflame Staff per class, Phoenix Feather, 300 gold), and a "Back to lobby" button.

### D. Progress

- Levels go up to 10. XP needed for levels 9 and 10: 1250 and 1600.
- The HUD shows "Floor 3 · Room 2 of 4" and so on.
- Debug switches `DEBUG_FLOOR=3` and `DEBUG_FLOOR=4` start there with gold for shop testing.

## Non-goals

Item drops from monsters (Stone Armor, Ember Blade as a drop, Mana Potion), an inventory screen, hidden chests, hero passives, sound, chat, phone controls, saving progress between games.

## Anti-goals

- A random room that can't be finished. Every rule from Slice 2 still holds: a safe path to the door always exists. The bridge counts as part of that path, and geysers and jets are never on the only path.
- Deaths you can't see coming. Every hit in Floor 3 and 4 has a visible warning first.
- Phase 2 of the dragon locking out an all-Knight team. The 3 s landing after every Meteor Rain always gives melee a window.
- Breaking Floors 1–2: every existing test keeps passing.

## Approaches

1. **Both floors at once, one push at the end.** One review, but nothing playable for a long time.
2. **Floor 3 first, push it, then Floor 4, push again (chosen).** Same design, but you can play the Molten Forge while the dragon is being built. If something feels wrong on Floor 3, you can tell me before Floor 4 copies the pattern.
3. **Skip to the dragon.** Fastest to "finished", but it skips the Forge, its set and the King. The mockups and the Floor 2 shop already promise those.

## How it works (decided)

- Same server-decides, browser-draws rule as before. Floors, rooms, shops and monster numbers stay data in `shared/`.
- New tile letters: `l` lava, `v` geyser vent, `j` flame-jet nozzle (in a wall), `r` crumbling platform. The bridge is a moving object, not a tile, and is sent in each snapshot.
- New spawn letters: `G` Rubble Golem, `K` Hollow King, `D` Ashmaw.
- New trap art follows the redraw from the last fix: drawn on the dungeon floor, sized to the space it uses. Lava glows and animates.

## Calls Claude made (check these)

- Floor 4 gets one warm-up room before the Roost, so the final floor isn't only a boss fight.
- Falling into lava means 50 damage and reappearing at the entrance (on the Roost, at the island's center). It doesn't mean instant death.
- The Ember Blade is sold in the Hollow Crown shop as the Knight's tier-3 weapon. It isn't a boss drop, since item drops aren't in this slice.
- Dragon loot is shown on the Victory screen as trophies, since the game ends there.
- Hollow Crown's team +10% damage doesn't stack with a second wearer.
- Levels 9 and 10 are added so Floors 3–4 still reward XP.

## Left to the builder

Exact room recipes, golem and dragon speeds, geyser timing offsets, flame-jet patterns per room, bridge stop positions, the dragon's attack order, gold tuning so a team can afford most of the Hollow Crown set, sprite art for the Golem, King and Ashmaw, and effects for every new skill in the same style as Slices 1–2.
