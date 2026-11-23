// The lobby: room codes, who is in which room, hero and color picks,
// lock-in and starting the game. It knows nothing about the dungeon itself.
const { CLASSES, COLORS } = require('../shared/data');

const MAX_PLAYERS = 4;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const COLOR_ORDER = Object.keys(COLORS);

function cleanName(name) {
  const trimmed = String(name == null ? '' : name).trim().slice(0, 12);
  return trimmed || 'Player';
}

function normalizeCode(code) {
  return String(code == null ? '' : code).trim().toUpperCase();
}

class Lobby {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.rooms = new Map();   // code -> room
    this.socketRoom = new Map(); // socket id -> code
  }

  makeCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(this.rng() * CODE_LETTERS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  addPlayer(room, socketId, name) {
    const used = new Set([...room.players.values()].map((p) => p.color));
    const color = COLOR_ORDER.find((c) => !used.has(c));
    room.players.set(socketId, { id: socketId, name: cleanName(name), heroClass: 'knight', color, locked: false });
    this.socketRoom.set(socketId, room.code);
  }

  createRoom(socketId, name) {
    this.leave(socketId);
    const code = this.makeCode();
    const room = { code, hostId: socketId, phase: 'lobby', players: new Map(), game: null };
    this.rooms.set(code, room);
    this.addPlayer(room, socketId, name);
    return { ok: true, code };
  }

  joinRoom(socketId, name, rawCode) {
    const code = normalizeCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'No room with that code' };
    if (room.phase !== 'lobby') return { ok: false, error: 'Game already started' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };
    this.leave(socketId);
    this.addPlayer(room, socketId, name);
    return { ok: true, code };
  }

  roomOf(socketId) {
    const code = this.socketRoom.get(socketId);
    return code ? this.rooms.get(code) || null : null;
  }

  pick(socketId, { heroClass, color } = {}) {
    const room = this.roomOf(socketId);
    if (!room || room.phase !== 'lobby') return { ok: false, error: 'Not in a lobby' };
    const me = room.players.get(socketId);
    if (me.locked) return { ok: true };
    if (heroClass !== undefined && !CLASSES.includes(heroClass)) return { ok: false, error: 'Unknown hero' };
    if (color !== undefined) {
      if (!COLORS[color]) return { ok: false, error: 'Unknown color' };
      const taken = [...room.players.values()].some((p) => p.id !== socketId && p.color === color);
      if (taken) return { ok: false, error: 'Color taken' };
    }
    if (heroClass !== undefined) me.heroClass = heroClass;
    if (color !== undefined) me.color = color;
    return { ok: true };
  }

  setLocked(socketId, locked) {
    const room = this.roomOf(socketId);
    if (!room || room.phase !== 'lobby') return;
    room.players.get(socketId).locked = !!locked;
  }

  start(socketId) {
    const room = this.roomOf(socketId);
    if (!room || room.phase !== 'lobby') return { ok: false, error: 'Not in a lobby' };
    if (room.hostId !== socketId) return { ok: false, error: 'Only the host can start' };
    if ([...room.players.values()].some((p) => !p.locked)) return { ok: false, error: 'Everyone must lock in' };
    room.phase = 'playing';
    return { ok: true };
  }

  // Remove a player. Returns the room they were in, or null if it is now gone.
  leave(socketId) {
    const room = this.roomOf(socketId);
    this.socketRoom.delete(socketId);
    if (!room) return null;
    room.players.delete(socketId);
    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return null;
    }
    if (room.hostId === socketId) room.hostId = room.players.keys().next().value;
    return room;
  }

  publicState(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({ ...p }))
    };
  }
}

module.exports = { Lobby, cleanName, normalizeCode, MAX_PLAYERS };
