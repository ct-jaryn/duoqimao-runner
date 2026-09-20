/* 夺旗猫跑酷 · Web Audio 引擎：合成音效 + 分关卡 BGM 序列器 */
(function (ns) {
  const MASTER = { sfx: 1, bgm: 1 };
  let ctx = null;
  let bgmTimer = null;
  let step = 0;
  let currentTrack = null;
  let enabled = { bgm: true, sfx: true };

  /* 每条 BGM：主旋律 + 低音 + 节奏，16 步循环 */
  const TRACKS = {
    cheerful: {
      tempo: 300,
      melody: [392, 440, 494, 440, 392, 330, 349, 392, 440, 523, 494, 440, 392, 349, 330, 349],
      bass: [196, 196, 220, 220, 165, 165, 174, 174],
      wave: "triangle",
    },
    groove: {
      tempo: 288,
      melody: [330, 392, 494, 392, 349, 440, 523, 440, 330, 392, 494, 587, 523, 440, 392, 349],
      bass: [165, 165, 174, 174, 131, 131, 147, 147],
      wave: "triangle",
    },
    neon: {
      tempo: 268,
      melody: [440, 523, 587, 523, 494, 587, 659, 587, 440, 523, 587, 659, 784, 659, 587, 494],
      bass: [110, 110, 131, 131, 98, 98, 123, 123],
      wave: "square",
    },
    drive: {
      tempo: 244,
      melody: [523, 494, 440, 494, 523, 587, 523, 494, 440, 392, 440, 494, 523, 587, 659, 587],
      bass: [131, 131, 147, 147, 165, 165, 174, 174],
      wave: "sawtooth",
    },
    night: {
      tempo: 262,
      melody: [659, 587, 523, 587, 659, 784, 659, 587, 523, 494, 523, 587, 659, 523, 440, 392],
      bass: [98, 98, 110, 110, 123, 123, 131, 131],
      wave: "triangle",
    },
    boss: {
      tempo: 210,
      melody: [330, 311, 330, 415, 330, 311, 262, 294, 330, 311, 330, 415, 466, 415, 370, 330],
      bass: [82, 82, 87, 87, 78, 78, 73, 73],
      wave: "sawtooth",
    },
  };

  const THEME_TRACK = {
    morning: "cheerful",
    park: "groove",
    neon: "neon",
    yard: "drive",
    rooftop: "night",
    storm: "boss",
  };

  function audioContext() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx ||= new Ctor();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(frequency, duration, options = {}) {
    const channel = options.channel === "bgm" ? enabled.bgm : enabled.sfx;
    if (!channel) return;
    const context = audioContext();
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime + (options.delay || 0);
    const volume = (options.volume || 0.045) * (options.channel === "bgm" ? MASTER.bgm : MASTER.sfx);
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(frequency, now);
    if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function noise(duration, options = {}) {
    if (!enabled.sfx) return;
    const context = audioContext();
    if (!context) return;
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.cutoff || 900;
    const gain = context.createGain();
    gain.gain.value = (options.volume || 0.05) * MASTER.sfx;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  const SFX = {
    coin: [[880, 0.08, { type: "sine", to: 1320, volume: 0.04 }], [1320, 0.07, { type: "triangle", delay: 0.045, volume: 0.024 }]],
    gem: [[784, 0.1, { type: "triangle", volume: 0.04 }], [1175, 0.14, { delay: 0.07, type: "sine", volume: 0.034 }], [1568, 0.16, { delay: 0.14, type: "sine", volume: 0.026 }]],
    heal: [[523, 0.11, { type: "sine", volume: 0.035 }], [659, 0.12, { type: "sine", delay: 0.08, volume: 0.034 }], [784, 0.16, { type: "triangle", delay: 0.16, volume: 0.032 }]],
    power: [[440, 0.1, { type: "square", to: 880, volume: 0.03 }], [880, 0.16, { type: "triangle", delay: 0.09, volume: 0.03 }]],
    stomp: [[360, 0.12, { type: "triangle", to: 540, volume: 0.042 }]],
    smash: [[180, 0.22, { type: "sawtooth", to: 60, volume: 0.05 }]],
    jump: [[360, 0.12, { type: "triangle", to: 560, volume: 0.036 }]],
    doubleJump: [[420, 0.13, { type: "triangle", to: 720, volume: 0.038 }]],
    hurt: [[220, 0.18, { type: "sine", to: 120, volume: 0.05 }], [146, 0.14, { type: "triangle", delay: 0.05, volume: 0.028 }]],
    fall: [[300, 0.34, { type: "sine", to: 90, volume: 0.045 }]],
    win: [[523, 0.12, { volume: 0.04 }], [659, 0.12, { delay: 0.1, volume: 0.04 }], [784, 0.14, { delay: 0.2, volume: 0.04 }], [1047, 0.28, { delay: 0.32, type: "triangle", volume: 0.038 }]],
    lose: [[294, 0.16, { volume: 0.04 }], [220, 0.22, { type: "triangle", delay: 0.13, volume: 0.034 }], [165, 0.3, { delay: 0.3, volume: 0.028 }]],
    skill: [[600, 0.1, { type: "square", to: 1200, volume: 0.032 }], [900, 0.12, { type: "triangle", delay: 0.06, volume: 0.028 }]],
    deny: [[200, 0.1, { type: "square", to: 150, volume: 0.022 }]],
    toggle: [[660, 0.09, { type: "sine", to: 880, volume: 0.026 }]],
    countdown: [[520, 0.12, { type: "triangle", volume: 0.032 }]],
    go: [[780, 0.2, { type: "triangle", to: 1180, volume: 0.036 }]],
    ui: [[520, 0.05, { type: "sine", volume: 0.02 }]],
    bossHit: [[140, 0.26, { type: "sawtooth", to: 70, volume: 0.055 }]],
  };

  function play(name) {
    const preset = SFX[name];
    if (!preset) return;
    for (const [frequency, duration, options] of preset) tone(frequency, duration, options);
    if (name === "smash" || name === "hurt" || name === "fall") noise(0.18, { cutoff: 700, volume: 0.035 });
  }

  function tick() {
    const track = TRACKS[currentTrack] || TRACKS.cheerful;
    if (!enabled.bgm || !ctx) return;
    const melody = track.melody[step % track.melody.length];
    const bass = track.bass[Math.floor(step / 2) % track.bass.length];
    const volume = 0.015 * MASTER.bgm;
    tone(melody, 0.26, { type: track.wave, volume, channel: "bgm" });
    if (step % 2 === 0) tone(bass, 0.46, { type: "sine", volume: volume * 0.85, channel: "bgm" });
    if (step % 4 === 2) tone(melody * 2, 0.09, { type: "square", volume: volume * 0.32, channel: "bgm" });
    step += 1;
  }

  ns.audio = {
    unlock() {
      return Boolean(audioContext());
    },
    setEnabled(flags) {
      enabled = { ...enabled, ...flags };
      if (!enabled.bgm) ns.audio.stopBgm();
    },
    get enabled() {
      return enabled;
    },
    play,
    startBgmFor(themeId) {
      currentTrack = THEME_TRACK[themeId] || "cheerful";
      ns.audio.startBgm();
    },
    startBgm() {
      if (!enabled.bgm || bgmTimer || !audioContext()) return;
      const track = TRACKS[currentTrack] || TRACKS.cheerful;
      tick();
      bgmTimer = window.setInterval(tick, track.tempo);
    },
    stopBgm() {
      if (!bgmTimer) return;
      window.clearInterval(bgmTimer);
      bgmTimer = null;
    },
    setBgmTrackForTheme(themeId) {
      const next = THEME_TRACK[themeId] || "cheerful";
      if (next === currentTrack) return;
      currentTrack = next;
      step = 0;
      if (bgmTimer) {
        window.clearInterval(bgmTimer);
        bgmTimer = null;
        ns.audio.startBgm();
      }
    },
  };
})(window.DQM);
