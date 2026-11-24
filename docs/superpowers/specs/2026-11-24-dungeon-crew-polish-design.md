# Dungeon Crew — Stage Wins, Shop Timer and Sound (Design)

Date: 2026-11-24
Status: draft, waiting for Drei's approval

## Intent

Drei asked for three things:
1. Make winning each stage feel better ("pagandahin pa yung pagpapanalo bawat stage").
2. Give the shop a time limit. When the time runs out, the next floor starts on its own.
3. Sound effects.

Right now, clearing a room just opens the door. Clearing a floor shows a 2.5 s card, then the shop. The shop waits until everyone presses Ready, and the game makes no sound at all.

## Goals

### A. Room cleared
- The last monster's death triggers a short **"Room cleared!"** banner, a gold burst, glowing door bars and a chime.
- The door slides open instead of just changing color.

### B. Floor cleared: a results screen
After a floor's boss dies, a **results screen** replaces today's small card for about 7 seconds before the shop opens:
- A big animated title, "FLOOR 1 CLEARED!", with confetti and a fanfare.
- **Stars (1–3) for the team:**
  - 1★ for clearing the floor.
  - +1★ if nobody was downed on the floor.
  - +1★ if the floor took under the target time: 4 / 5 / 6 / 5 minutes for Floors 1–4.
  - The stars pop in one by one, each with a sound.
- **One card per player,** counting up: monsters slain, damage dealt, gold earned on this floor, times downed, revives given.
- **Badges:**
  - **MVP** for the most damage.
  - **Lifesaver** for the most revives, shown only if anyone revived.
  - **Untouchable** for anyone never downed.
- The final Victory screen shows the same stats for the whole run.

### C. Shop timer
- The shop has a **45 second** timer for everyone, shown at the top of the shop.
- It turns red and ticks in the last 10 seconds.
- When it hits 0, the next floor starts for everyone, ready or not.
- If everyone presses Ready earlier, it starts right away, like today.
- Purchases made before the timer ends are kept.

### D. Sound effects
- **Made by code (Web Audio), not files:** nothing to download and no copyright problems, and the sounds are easy to tweak.
- **About 30 sounds:**
  - Each class's attacks and skills
  - Hits and hurts
  - Monster deaths
  - Boss roars and boss attacks
  - Hazards: spikes, geysers, jets, lava, crumbling, meteors
  - Coins, buying, level up, downed, revive
  - Room clear chime, floor clear fanfare, stars, shop countdown ticks, victory
- **Volume control:** a slider and a mute button on the menu and in the pause screen. Saved on the device.
- Sounds react to what each player sees: the same events that make visual effects today also play sounds.

## Non-goals

Background music (it could come next as its own piece), voice lines, and per-sound volume settings.

## Anti-goals

- Sound blasting at full volume or overlapping into noise. Repeats of the same sound are capped (for example, at most 4 coin sounds at once).
- The shop timer kicking players out mid-purchase without warning. The last 10 s are clearly marked.
- Stats that differ between players' screens. The server counts them and sends the same numbers to everyone.

## Approaches

- **Sounds:**
  - **Code-made with Web Audio (chosen):** works offline and on Vercel, and has no licenses.
  - **Free sound packs (CC0 files):** they sound more "real", but Drei would have to download and add files.
- **Results screen:**
  - **An HTML overlay like the shop (chosen):** easy to style and matches the menus.
  - **Drawn in Phaser:** harder to lay out text and cards.

## Calls Claude made (check these)

- Shop time: 45 s.
- Star targets: 4 / 5 / 6 / 5 minutes for Floors 1–4.
- The results screen lasts about 7 s and can't be skipped.
- The default volume is 70%.

## Left to the builder

The exact sound recipes, the confetti look, the count-up speed and the card layout.
