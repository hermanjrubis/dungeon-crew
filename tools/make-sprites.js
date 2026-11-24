// Writes the placeholder sprites from shared/sprites.js as PNG files into client/assets/.
// Run with: npm run sprites
// Uses only Node's built-in zlib, no extra packages.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spriteFiles } = require('../shared/sprites');
const sheets = require('../shared/art');

const OUT = path.join(__dirname, '..', 'client', 'assets');

// CRC32, needed by the PNG format.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Scale a 16x16 letter map to size x size pixels (nearest neighbour) and encode as PNG.
function encodePng(rows, palette, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // no filter
    const my = Math.floor((y * rows.length) / size);
    for (let x = 0; x < size; x++) {
      const mx = Math.floor((x * rows[my].length) / size);
      const ch = rows[my][mx];
      const i = rowStart + 1 + x * 4;
      if (ch === '.' || !palette[ch]) continue; // transparent
      const [r, g, b] = hexToRgb(palette[ch]);
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;  // bit depth
  header[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Encode a grid of colors (rows of '#RRGGBB' or null) as a PNG.
function encodeGrid(grid) {
  const h = grid.length, w = grid[0].length;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      if (!c) continue;
      const [r, g, b] = hexToRgb(c);
      const i = rowStart + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// A sheet: every frame side by side in one row.
function sheetGrid(sheet) {
  const frames = sheet.frames.map((_, i) => sheets.renderSheetFrame(sheet, i));
  const size = sheet.size;
  return Array.from({ length: size }, (_, y) => frames.flatMap((f) => f[y]));
}

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  const made = new Set();
  for (const sh of sheets.sheetFiles()) {
    fs.writeFileSync(path.join(OUT, sh.file), encodeGrid(sheetGrid(sh)));
    fs.writeFileSync(path.join(OUT, sh.portrait), encodeGrid(sheets.renderSheetFrame(sh, sh.anims.idle.start)));
    made.add(sh.portrait);
  }
  // characters not redrawn yet keep their old single picture
  let old = 0;
  for (const s of spriteFiles()) {
    if (made.has(s.file)) continue;
    fs.writeFileSync(path.join(OUT, s.file), encodePng(s.rows, s.palette, s.size));
    old++;
  }
  console.log(`Wrote ${made.size} sprite sheets and ${old} old sprites to client/assets/`);
}

module.exports = { encodePng, encodeGrid, sheetGrid };
