import { PLAYER_COUNTS } from '../core/renderer.js';

let nextId = 1;

export class PlayerManager {
  constructor() {
    this.players = [];
    this.maxPlayers = 12;
  }

  create(name = '', avatar = null) {
    const player = {
      id: `p${nextId++}`,
      name: name || `Player ${this.players.length + 1}`,
      avatar: null,
      avatarUrl: null,
    };
    if (avatar) this.setAvatar(player, avatar);
    return player;
  }

  setAvatar(player, source) {
    if (source instanceof HTMLImageElement) {
      player.avatar = source;
      player.avatarUrl = source.src;
    } else if (typeof source === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        player.avatar = img;
      };
      img.src = source;
      player.avatarUrl = source;
    }
  }

  add(name) {
    if (this.players.length >= this.maxPlayers) return null;
    const p = this.create(name);
    this.players.push(p);
    return p;
  }

  remove(id) {
    this.players = this.players.filter((p) => p.id !== id);
  }

  updateName(id, name) {
    const p = this.players.find((x) => x.id === id);
    if (p) p.name = name.trim() || p.name;
  }

  setCount(count) {
    const target = PLAYER_COUNTS.includes(count) ? count : 4;
    while (this.players.length < target) this.add();
    while (this.players.length > target) this.players.pop();
    return this.players;
  }

  loadFromExternal(list) {
    this.players = [];
    for (const raw of list) {
      const p = this.create(raw.name || 'Player');
      p.id = raw.id || p.id;
      p.drinks = raw.drinks ? [...raw.drinks] : [];
      p.sessionDrinks = 0;
      p.sex = raw.sex;
      p.age = raw.age;
      p.heightCm = raw.heightCm;
      p.weightKg = raw.weightKg;
      if (raw.avatarUrl) this.setAvatar(p, raw.avatarUrl);
      this.players.push(p);
    }
    if (this.players.length < 2) {
      while (this.players.length < 2) this.add();
    }
    return this.players;
  }

  toJSON() {
    return this.players.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl }));
  }
}

export { PLAYER_COUNTS };
