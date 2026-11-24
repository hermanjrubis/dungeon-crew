# Dungeon Crew — Background Music, Attack Sounds, Two New Heroes (Design)

Date: 2026-11-24
Status: draft, waiting for Drei's approval

## Intent

Drei asked for:
1. Background music.
2. Sounds on every attack and skill. His video shows the Mage's basic bolts were silent. That session ran on the old game server: Cloudflare finished updating a minute after he started, and the old server didn't send attack events.
3. A tank hero whose skills are about rocks: throws rocks, very tough ("makunat"), with a passive.
4. One more hero, so there are 5 to choose from.

## A. Music

- **Made in code like the sound effects:** a small chiptune player built on Web Audio, with no files and no licenses.
- **Tracks:**
  - Menu & lobby
  - The camp shop
  - One theme per floor:
    - Cellar: calm, minor key
    - Caverns: eerie and echoey
    - Forge: driving drums
    - Roost: big and epic
  - A boss theme for boss rooms
  - A short victory tune
- Each track loops for about 30–60 s. Switching tracks crossfades over 1 s.
- **Separate Music and Effects volume sliders** on the menu and the pause screen, saved on the device. Music starts at 40% and effects at 70%.
- Music starts after the first click, like the effects.

## B. Attack and skill sounds

- **Your own attacks play a sound the instant you attack.** The browser doesn't wait for the server, so there's no delay even on slow internet.
- Teammates' attacks still play from the server's events, a bit quieter.
- **Every skill of all 5 heroes gets its own sound,** including the two new heroes.
- After this update ships, we confirm on the live link that basic attacks make sound.

## C. New hero: Stonewarden (tank, rocks)

| | |
|---|---|
| HP | **170** (the most) |
| Speed | 125 (the slowest) |
| Starting weapon | Cracked Sling, +4 |
| **Passive: Thick Skin** | Takes **30% less damage** from everything, poison, burning and lava included. Pushes (Shield Bash on him doesn't apply, Wing Gust) move him only half as far. |
| Attack: **Rock Throw** | Throws a heavy rock. Shorter range than an arrow, slower to fire (0.7 s), but hits hard (base damage 11). |
| Q: **Boulder Toss** (cd 8 s) | Rolls a big boulder in a straight line. It hits **every** monster it passes for 22 and knocks them aside, and breaks on walls. |
| Space: **Quake Stomp** (cd 12 s) | Stomps the ground: rocks burst up around him (2-tile radius), dealing 14 and **stunning** monsters for 1.2 s. Bosses are only slowed. |

- **Colors and art:** four colors like the others, with gray-brown stone armor and a big rock in hand.
- **Shop weapons:** Iron Sling, then Granite Hammer-Sling, then Magma Sling.
- **Dragon trophy:** Mountainheart.

## D. Fifth hero (Drei picks one)

Claude recommends the **Rogue**, the only missing play style (fast melee).

- **Rogue (recommended):** the fastest hero, with low HP (75).
  - **Attack:** quick dagger stabs.
  - **Q: Shadow Step.** Dash through monsters, cutting each one.
  - **Space: Smoke Bomb.** Monsters lose track of the team for 3 s.
  - **Passive: Backstab.** Double damage from behind (works great on Golems).
- **Bard:** support.
  - **Attack:** sound waves.
  - **Q: War Song.** The team gets +20% damage for 6 s.
  - **Space: Lullaby.** Monsters nearby fall asleep.
  - **Passive:** teammates near the Bard regenerate HP.
- **Engineer:** builds things.
  - **Attack:** a wrench.
  - **Q: Turret.** Shoots on its own for 10 s.
  - **Space: Mine.** Explodes when a monster steps on it.
  - **Passive:** gets 10% more gold.

## Non-goals

Raising the player limit above 4, letting two players pick the same hero (still allowed, same as now), and voice lines.

## Anti-goals

- **Music drowning out the warnings:** music stays under the effects, and boss tells are still clearly heard.
- **A tank that can't die:** Thick Skin is strong but he still goes down if he stands in lava or fire.
- **Breaking the existing heroes:** every current test keeps passing.

## Calls Claude made (check these)

- The tank's name, Stonewarden, and the numbers above.
- Music at 40% and effects at 70% by default.
- Seven tracks: menu, shop, four floors, boss, plus the victory tune.

## Left to the builder

The exact melodies and drum patterns, the pixel art for both heroes, and the effect visuals for the new skills.
