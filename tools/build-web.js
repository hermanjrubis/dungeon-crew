// Builds the game page for Vercel into dist/.
// Run with: GAME_SERVER=https://dungeon-crew.<you>.workers.dev npm run build:web
// (On Vercel, set GAME_SERVER in the project's Environment Variables.)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Accepts https://x, wss://x/ws, x.workers.dev, http://localhost:8787 ... and
// returns the WebSocket address the page should use, or null if empty.
function serverUrl(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  s = s.replace(/\/+$/, '');
  if (!s.endsWith('/ws')) s += '/ws';
  return s;
}

function build(outDir, gameServer) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'client'), outDir, { recursive: true });
  fs.cpSync(path.join(ROOT, 'shared'), path.join(outDir, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'vendor'), { recursive: true });
  fs.copyFileSync(require.resolve('phaser/dist/phaser.min.js'), path.join(outDir, 'vendor', 'phaser.min.js'));
  const url = serverUrl(gameServer);
  fs.writeFileSync(path.join(outDir, 'config.js'), url ? `window.DC_SERVER = ${JSON.stringify(url)};\n` : 'window.DC_SERVER = null;\n');
  return url;
}

if (require.main === module) {
  const url = build(path.join(ROOT, 'dist'), process.env.GAME_SERVER);
  if (url) console.log(`Built dist/ for game server ${url}`);
  else console.log('Built dist/ WITHOUT a game server: set GAME_SERVER to your Cloudflare address.');
}

module.exports = { serverUrl, build };
