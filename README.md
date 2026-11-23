# Dungeon Crew

A co-op dungeon crawler for 2–4 players that runs in the browser. Friends join a
room with a 4-letter code, pick a hero (Knight, Archer or Mage), and fight
through Floor 1, the Sunken Cellar: three rooms of Gloops, Skitterbats, spike
traps and crumbling floors, then the Gloop Mother boss, then a camp shop.

This is **Slice 1**. Floors 2–4, more bosses and the dragon come in later slices.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open <http://localhost:3000>, type a name and press **Create room**.

### Play with friends on the same Wi-Fi

1. Run `npm start` on one laptop.
2. Find that laptop's IP address (Windows: `ipconfig`, Mac: System Settings → Wi-Fi → Details). It looks like `192.168.1.23`.
3. Friends open `http://192.168.1.23:3000` and type your room code, or you press **Copy invite link** in the lobby and send it to them.

If friends can't connect, allow Node.js through the laptop's firewall. Some school
networks block devices from talking to each other; then use the online option below.

### Put it online (Render)

1. Push this folder to a GitHub repository.
2. On [render.com](https://render.com), create a **Web Service** from that repository.
3. Build command: `npm install` · Start command: `npm start`.
4. Share the `https://….onrender.com` link. (Free servers sleep when nobody uses
   them, so the first visit can take a minute.)

## Controls

| Key | What it does |
|---|---|
| W A S D | Move |
| Mouse click | Attack toward the mouse |
| Q | Main skill (Shield Bash / Arrow Rain / Fireball) |
| Space | Second skill (Taunt / Dodge Roll / Heal Circle) |
| E (hold) | Revive a downed teammate next to you (3 seconds) |
| 1 | Drink a Health Potion |
| 2 | Use a Revive Feather on the nearest downed teammate |
| Esc or the ⏸ button | Pause for the whole team (anyone can resume) |

If everyone goes down, the room starts over.

## How the code is organized

```
server/          runs on the computer that hosts the game
  index.js       web server + live connection (Socket.IO), 20 updates per second
  lobby.js       room codes, players, hero and color picks, host, start
  game.js        one game: rooms, doors, gold, XP, levels, reviving, room reset
  heroes.js      hero movement, attacks and skills
  enemies.js     Gloop and Skitterbat behaviour
  boss.js        Gloop Mother
  ai.js          helpers every monster uses (targeting, moving, touch damage)
  hazards.js     spikes, cracked floor, pits, puddles
  shop.js        the camp shop
shared/          used by BOTH the server and the browser
  data.js        every number: HP, damage, speeds, cooldowns, prices
  rooms.js       the room layouts, drawn with letters
  tiles.js       walls and collision
  sprites.js     the placeholder pixel art
client/          what the players' browsers load
  index.html     all the screens
  css/style.css  the look
  js/            menu, lobby, HUD, shop, and the Phaser dungeon scene
  assets/        sprite PNGs
test/            automated tests (npm test)
```

**The server is the referee.** Browsers only send which keys are pressed; the
server moves everyone, decides every hit and hands out gold. That keeps all
players' screens the same and makes cheating hard.

## Changing the game

- **Balance:** edit the numbers in `shared/data.js` (hero HP, damage, cooldowns, monster stats, shop prices).
- **Rooms:** edit the letter grids in `shared/rooms.js`. Every row must be 24 letters and each room 13 rows.
  `w` wall, `f` floor, `s` spikes, `x` cracked floor, `p` pit, `u` puddle, `d` door, `e` entry,
  `g` Gloop, `b` Skitterbat, `M` Gloop Mother.
- **Art:** replace any PNG in `client/assets/` with your own drawing of the same file name and size
  (heroes 48×48, Gloop and bat 48×48, Mini Gloop 32×32, Gloop Mother 96×96, Half Mother 64×64).
  `npm run sprites` rebuilds the placeholder art from `shared/sprites.js` (it overwrites the PNGs).

## Tests

```bash
npm test
```

The tests check the game rules (combat, monsters, hazards, the boss, the shop, the lobby)
and start a real server with two fake players to check the multiplayer connection.

Testing the shop quickly: `DEBUG_SKIP_TO_SHOP=1 npm start` jumps straight to the shop with 150 gold.
