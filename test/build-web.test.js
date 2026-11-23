const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serverUrl, build } = require('../tools/build-web');

test('serverUrl turns any address form into a ws url', () => {
  assert.strictEqual(serverUrl('https://dungeon-crew.kai.workers.dev'), 'wss://dungeon-crew.kai.workers.dev/ws');
  assert.strictEqual(serverUrl('https://dungeon-crew.kai.workers.dev/'), 'wss://dungeon-crew.kai.workers.dev/ws');
  assert.strictEqual(serverUrl('wss://x.workers.dev/ws'), 'wss://x.workers.dev/ws');
  assert.strictEqual(serverUrl('dungeon-crew.kai.workers.dev'), 'wss://dungeon-crew.kai.workers.dev/ws');
  assert.strictEqual(serverUrl('http://localhost:8787'), 'ws://localhost:8787/ws');
  assert.strictEqual(serverUrl('  '), null);
  assert.strictEqual(serverUrl(undefined), null);
});

test('build writes the page, shared files, phaser and config', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-web-'));
  build(out, 'https://dungeon-crew.kai.workers.dev');
  for (const f of ['index.html', 'js/net.js', 'assets/dragon.png', 'shared/data.js', 'shared/rooms.js', 'vendor/phaser.min.js']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  assert.strictEqual(fs.readFileSync(path.join(out, 'config.js'), 'utf8').trim(), 'window.DC_SERVER = "wss://dungeon-crew.kai.workers.dev/ws";');
});
