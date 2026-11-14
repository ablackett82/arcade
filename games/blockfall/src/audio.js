// Chiptune-style sound made live with Web Audio. Both tunes are original compositions.

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(n) {
  if (n === 'R') return 0;
  const m = n.match(/^([A-G]#?)(\d)$/);
  const midi = 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function seq(s) {
  // "E5:2 C5:1 ..." -> [[freq, eighths], ...]
  return s.trim().split(/\s+/).map((t) => {
    const [n, d] = t.split(':');
    return [freq(n), Number(d)];
  });
}
function bass(roots) {
  // root/octave bounce, 8 eighths per bar
  const out = [];
  for (const r of roots) {
    const lo = freq(`${r}2`), hi = freq(`${r}3`);
    for (let i = 0; i < 4; i++) out.push([lo, 1], [hi, 1]);
  }
  return out;
}

const TUNES = {
  tune1: {
    bpm: 150,
    lead: seq(`E5:2 C5:1 D5:1 E5:2 A4:2  G4:1 A4:1 C5:2 B4:2 G4:2  A4:2 C5:1 E5:1 D5:2 C5:2  B4:3 G4:1 A4:4
               F5:2 E5:1 D5:1 C5:2 A4:2  D5:1 E5:1 F5:2 E5:2 C5:2  B4:2 D5:1 B4:1 G4:2 B4:2  A4:6 R:2`),
    bass: bass(['A', 'E', 'A', 'E', 'F', 'D', 'E', 'A']),
  },
  tune2: {
    bpm: 168,
    lead: seq(`C5:1 E5:1 G5:2 E5:1 C5:1 D5:2  E5:1 D5:1 C5:2 A4:2 G4:2  F4:1 A4:1 C5:2 F5:2 E5:2  D5:1 C5:1 D5:2 G4:4
               C5:1 E5:1 G5:2 A5:2 G5:2  F5:1 E5:1 D5:2 C5:2 A4:2  G4:1 A4:1 B4:2 D5:2 B4:2  C5:6 R:2`),
    bass: bass(['C', 'A', 'F', 'G', 'C', 'F', 'G', 'C']),
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.5;
    this.muted = false;
    this.tune = null;
    this.timer = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.dest = this.ctx.createMediaStreamDestination ? this.ctx.createMediaStreamDestination() : null;
      if (this.dest) this.master.connect(this.dest);
      this.apply();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  apply() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.35;
  }

  setVolume(v) { this.volume = v; this.apply(); }
  setMuted(m) { this.muted = m; this.apply(); }

  tone(type, f, start, dur, vol = 0.5, slideTo = null) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.setValueAtTime(vol, start + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  noise(start, dur, vol = 0.4) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.connect(g).connect(this.master);
    s.start(start);
  }

  sfx(name) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'move': this.tone('square', 660, t, 0.03, 0.25); break;
      case 'rotate': this.tone('square', 520, t, 0.06, 0.3, 1040); break;
      case 'lock': this.noise(t, 0.07, 0.35); break;
      case 'drop': this.noise(t, 0.12, 0.5); this.tone('square', 220, t, 0.08, 0.3, 110); break;
      case 'select': this.tone('square', 880, t, 0.05, 0.3); this.tone('square', 1320, t + 0.05, 0.08, 0.3); break;
      case 'pause': this.tone('square', 990, t, 0.05, 0.3); this.tone('square', 660, t + 0.06, 0.05, 0.3); break;
      case 'clear': [660, 880, 1100].forEach((f, i) => this.tone('square', f, t + i * 0.06, 0.07, 0.3)); break;
      case 'quad': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, t + i * 0.07, 0.1, 0.35)); break;
      case 'level': [784, 988, 1175, 1568].forEach((f, i) => this.tone('square', f, t + i * 0.05, 0.06, 0.3)); break;
      case 'over': [440, 392, 349, 294, 262, 196].forEach((f, i) => this.tone('triangle', f, t + i * 0.16, 0.18, 0.6)); break;
      case 'win': [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone('square', f, t + i * 0.12, 0.12, 0.35)); break;
    }
  }

  music(name) {
    if (this.tune === name) return;
    this.tune = name;
    clearTimeout(this.timer);
    if (!name || !TUNES[name]) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const song = TUNES[name];
    const eighth = 60 / song.bpm / 2;
    const tracks = [
      { notes: song.lead, i: 0, at: ctx.currentTime + 0.1, type: 'square', vol: 0.18, octave: 1 },
      { notes: song.bass, i: 0, at: ctx.currentTime + 0.1, type: 'triangle', vol: 0.4, octave: 1 },
    ];
    const pump = () => {
      if (this.tune !== name) return;
      const horizon = ctx.currentTime + 0.4;
      for (const tr of tracks) {
        if (tr.at < ctx.currentTime) tr.at = ctx.currentTime + 0.05;
        while (tr.at < horizon) {
          const [f, d] = tr.notes[tr.i];
          const dur = d * eighth;
          if (f) this.tone(tr.type, f, tr.at, dur * 0.92, tr.vol);
          tr.at += dur;
          tr.i = (tr.i + 1) % tr.notes.length;
        }
      }
      this.timer = setTimeout(pump, 120);
    };
    pump();
  }
}
