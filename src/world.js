/* 夺旗猫跑酷 · 世界模拟：关卡生成、物理、碰撞、道具、连击、技能、BOSS、终点夺旗 */
(function (ns) {
  const { CONFIG, SCORE, POWERUPS, utils } = ns;
  const { random, randomChoice, clamp, intersects } = utils;
  const PX_PER_M = 10;
  const MAX_PARTICLES = 320;

  function createRun(level, character) {
    const state = {
      level,
      character,
      theme: ns.THEMES[level.theme],
      mode: "countdown",
      phase: "run",
      time: 0,
      countdown: CONFIG.countdown,
      distance: 0,
      speed: level.startSpeed,
      effSpeed: level.startSpeed,
      score: 0,
      coins: 0,
      gems: 0,
      coinsSinceHeal: 0,
      lives: character.maxLives,
      combo: 0,
      comboTimer: 0,
      multiplier: 1,
      bestCombo: 0,
      shield: false,
      star: 0,
      magnet: 0,
      rocket: 0,
      dash: 0,
      slowmo: 0,
      slam: 0,
      skillCooldown: 0,
      platforms: [],
      pipes: [],
      spikes: [],
      enemies: [],
      coinList: [],
      powerList: [],
      particles: [],
      clouds: [
        { x: 80, y: 82, scale: 0.86 },
        { x: 390, y: 58, scale: 1.08 },
        { x: 760, y: 106, scale: 0.74 },
        { x: 560, y: 130, scale: 0.6 },
      ],
      nextChunkX: 0,
      nextCoinX: 340,
      nextEnemyDistance: 90,
      nextBirdDistance: 150,
      nextPowerDistance: 110,
      flag: null,
      boss: null,
      bossAt: level.boss ? level.boss.at : null,
      captureTimer: 0,
      shake: 0,
      flash: 0,
      toast: null,
      toastTimer: 0,
      result: null,
      stats: { stomps: 0, powers: 0, rescues: 0 },
      cat: {
        x: CONFIG.catX,
        y: CONFIG.groundY - character.height,
        vy: 0,
        width: character.width,
        height: character.height,
        grounded: true,
        jumpsLeft: character.jumps,
        action: "run",
        invincible: 0,
        coyote: 0,
        landFlash: 0,
        riding: null,
        lastY: CONFIG.groundY - character.height,
        stepTimer: 0,
      },
    };
    seedLevel(state);
    return state;
  }

  function seedLevel(state) {
    state.platforms.push({ x: -400, y: CONFIG.groundY, width: 1160, height: 150, type: "ground" });
    state.nextChunkX = 720;
    ensureAhead(state);
    state.cat.x = 220;
  }

  /* ---------------------------------------------------------------- 生成 */

  function difficulty(state) {
    return clamp(state.distance / state.level.goal, 0, 1);
  }

  function groundRight(state) {
    return state.platforms.reduce((right, p) => (p.type === "ground" ? Math.max(right, p.x + p.width) : right), -Infinity);
  }

  function groundAt(state, x) {
    return state.platforms.some((p) => p.type === "ground" && x >= p.x && x <= p.x + p.width);
  }

  function ensureAhead(state) {
    const gen = state.level.gen;
    while (state.nextChunkX < CONFIG.width + 760) spawnChunk(state);
    while (state.nextCoinX < CONFIG.width + 800) spawnCoinGroup(state);
    let guard = 0;
    while (state.enemies.length < 110 && state.nextEnemyDistance < state.distance + 150 && guard < 40) {
      guard += 1;
      if (!spawnEnemy(state)) break;
    }
    if (gen.birdGap) {
      guard = 0;
      while (state.enemies.length < 110 && state.nextBirdDistance < state.distance + 170 && state.distance > 120) {
        guard += 1;
        spawnBird(state);
        if (guard > 30) break;
      }
    }
    while (state.nextPowerDistance < state.distance + 120) {
      spawnPowerup(state);
      if (state.nextPowerDistance > state.distance + 400) break;
    }
  }

  function spawnChunk(state) {
    const gen = state.level.gen;
    const diff = difficulty(state);
    const lastRight = groundRight(state);
    const rawGap = random(gen.gap[0], gen.gap[1]) * (0.74 + diff * 0.42);
    const gap = Math.min(190, rawGap);
    const width = Math.max(158, random(gen.chunk[0], gen.chunk[1]) * (1 - diff * 0.18));
    const safeGap = lastRight > CONFIG.catX + 220 ? gap : 0;
    const x = state.nextChunkX + safeGap;
    state.platforms.push({ x, y: CONFIG.groundY, width, height: 150, type: "ground" });

    if (safeGap > 118 && Math.random() < 0.6) {
      state.platforms.push(makePlatform(state, x - safeGap + safeGap / 2 - 52, randomChoice([296, 328, 352]), 110, gen.moving > Math.random()));
    }

    if (Math.random() < gen.floatPlatform) {
      const usable = Math.max(90, width - 230);
      const px = x + random(60, usable);
      const py = randomChoice([268, 306, 340]);
      state.platforms.push(makePlatform(state, px, py, random(112, 188), Math.random() < gen.moving));
    }

    if (width > 250 && Math.random() < gen.pipe) {
      const height = randomChoice([64, 78, 94]);
      state.pipes.push({ x: x + random(120, width - 90), y: CONFIG.groundY - height, width: 56, height });
    }

    if (width > 300 && Math.random() < gen.spike) {
      const width2 = random(44, 82);
      state.spikes.push({ x: x + random(150, width - 130), y: CONFIG.groundY - 20, width: width2, height: 20 });
    }

    state.nextChunkX = x + width;
  }

  function makePlatform(state, x, y, width, moving) {
    return {
      x,
      y,
      width,
      height: 26,
      type: "platform",
      moving,
      baseY: y,
      amp: moving ? random(26, 52) : 0,
      speed: moving ? random(0.9, 1.5) : 0,
      phase: random(0, Math.PI * 2),
    };
  }

  function spawnCoinGroup(state) {
    const gen = state.level.gen;
    const lane = randomChoice(["low", "low", "mid", "arc"]);
    const count = lane === "arc" ? 5 : 4;
    const startX = state.nextCoinX + random(70, 150);
    for (let index = 0; index < count; index += 1) {
      const arc = lane === "arc" ? Math.abs(index - 2) * 20 : 0;
      const y = lane === "low" ? CONFIG.groundY - 78 : lane === "mid" ? CONFIG.groundY - 150 : CONFIG.groundY - 186 + arc;
      state.coinList.push({ x: startX + index * 44, y, width: 30, height: 30, kind: "coin", vx: 0, vy: 0 });
    }
    if (Math.random() < gen.gem) {
      state.coinList.push({ x: startX + count * 22, y: CONFIG.groundY - 232 - random(0, 34), width: 30, height: 30, kind: "gem", vx: 0, vy: 0 });
    }
    state.nextCoinX = startX + random(250, 400);
  }

  function spawnPowerup(state) {
    const kinds = Object.keys(POWERUPS);
    const kind = state.lives < state.character.maxLives && Math.random() < 0.34 ? "heart" : randomChoice(kinds);
    const delta = Math.max(0, state.nextPowerDistance - state.distance) * PX_PER_M;
    const x = clamp(CONFIG.width + 150 + delta, CONFIG.width + 130, state.nextChunkX - 40);
    state.powerList.push({ x, y: CONFIG.groundY - random(96, 190), width: 38, height: 38, kind, spin: 0 });
    state.nextPowerDistance += random(150, 240);
  }

  function spawnEnemy(state) {
    const gen = state.level.gen;
    const stage = Math.min(3, Math.floor(state.distance / 400));
    const tighten = [1, 0.9, 0.82, 0.74][stage];
    const gap = random(gen.enemyGap[0], gen.enemyGap[1]) * tighten;
    const delta = Math.max(0, state.nextEnemyDistance - state.distance) * PX_PER_M;
    const x = clamp(CONFIG.width + 130 + delta, CONFIG.width + 110, state.nextChunkX - 70);
    if (!groundAt(state, x + 22)) {
      state.nextEnemyDistance += 8;
      return true;
    }
    const variant = randomChoice(gen.enemyTypes);
    const size = {
      grunt: { width: 44, height: 40 },
      spike: { width: 48, height: 44 },
      shield: { width: 52, height: 46 },
      sprinter: { width: 40, height: 36 },
    }[variant];
    state.enemies.push({
      type: "walker",
      variant,
      x,
      y: CONFIG.groundY - size.height,
      width: size.width,
      height: size.height,
      vx: variant === "sprinter" ? randomChoice([-96, -80, -64]) : variant === "shield" ? randomChoice([-30, -18, 18]) : randomChoice([-56, -42, -28, 26]),
      phase: random(0, 6.28),
      alive: true,
      stompable: variant !== "spike",
    });
    state.nextEnemyDistance += gap;
    return true;
  }

  function spawnBird(state) {
    const y = randomChoice([186, 226, 266]);
    const delta = Math.max(0, state.nextBirdDistance - state.distance) * PX_PER_M;
    const x = clamp(CONFIG.width + 150 + delta, CONFIG.width + 130, CONFIG.width + 2400);
    state.enemies.push({
      type: "bird",
      variant: "bird",
      x,
      y,
      baseY: y,
      width: 52,
      height: 36,
      vx: randomChoice([-98, -82, -66]),
      phase: random(0, 6.28),
      alive: true,
      stompable: true,
    });
    state.nextBirdDistance += random(state.level.gen.birdGap * 0.8, state.level.gen.birdGap * 1.4);
  }

  /* ---------------------------------------------------------------- 主更新 */

  function update(state, dt) {
    state.time += dt;
    if (state.mode === "countdown") {
      const before = Math.ceil(state.countdown);
      state.countdown -= dt;
      const after = Math.ceil(state.countdown);
      if (after !== before && after > 0) ns.audio.play("countdown");
      if (state.countdown <= 0) {
        state.mode = "playing";
        ns.audio.play("go");
      }
      updateParticles(state, dt);
      return;
    }

    decayTimers(state, dt);
    const slow = state.slowmo > 0 ? 0.58 : 1;
    const pdt = dt * slow;

    state.speed = Math.min(state.level.maxSpeed, state.speed + state.level.speedGain * dt);
    state.effSpeed = state.speed * (state.dash > 0 ? 1.28 : 1) * (state.rocket > 0 ? 1.42 : 1) * (state.phase === "finish" ? 1.1 : 1);
    const moving = state.phase === "run" || state.phase === "finish";
    const move = moving ? state.effSpeed * pdt : 0;
    if (moving) state.distance += move / PX_PER_M;

    moveWorld(state, move, pdt);
    updateCat(state, pdt, dt);
    if (state.phase === "run") ensureAhead(state);
    collectPickups(state, dt, move);
    handleHazards(state);
    updateParticles(state, pdt);
    trimWorld(state);

    if (state.cat.y > CONFIG.height + 140) rescueAfterFall(state);
    if (state.boss) updateBoss(state, dt);
    if (state.phase === "run" && state.bossAt && state.distance >= state.bossAt) startBoss(state);
    if (state.phase === "run" && state.distance >= state.level.goal) startFinish(state);
    if (state.flag && !state.flag.captured && state.phase === "finish") checkCapture(state, dt);
    if (state.captureTimer > 0) {
      state.captureTimer -= dt;
      if (state.captureTimer <= 0) finishRun(state, true, "flag");
    }
    if (state.toastTimer > 0) state.toastTimer -= dt;
  }

  function decayTimers(state, dt) {
    state.star = Math.max(0, state.star - dt);
    state.magnet = Math.max(0, state.magnet - dt);
    state.rocket = Math.max(0, state.rocket - dt);
    state.dash = Math.max(0, state.dash - dt);
    state.slowmo = Math.max(0, state.slowmo - dt);
    state.slam = Math.max(0, state.slam - dt);
    state.skillCooldown = Math.max(0, state.skillCooldown - dt);
    state.shake = Math.max(0, state.shake - dt * 34);
    state.flash = Math.max(0, state.flash - dt * 2.4);
    state.cat.invincible = Math.max(0, state.cat.invincible - dt);
    state.cat.coyote = Math.max(0, state.cat.coyote - dt);
    state.jumpBuffer = Math.max(0, (state.jumpBuffer || 0) - dt);
    state.cat.landFlash = Math.max(0, state.cat.landFlash - dt * 5);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
  }

  function moveWorld(state, move, dt) {
    state.nextChunkX -= move;
    state.nextCoinX -= move;
    for (const platform of state.platforms) {
      platform.x -= move;
      if (platform.moving) {
        platform.phase += dt * platform.speed * 2.1;
        platform.y = platform.baseY + Math.sin(platform.phase) * platform.amp;
      }
    }
    for (const pipe of state.pipes) pipe.x -= move;
    for (const spike of state.spikes) spike.x -= move;
    for (const coin of state.coinList) coin.x -= move;
    for (const power of state.powerList) {
      power.x -= move;
      power.spin += dt * 2.6;
    }
    for (const enemy of state.enemies) {
      enemy.x -= move;
      enemy.x += enemy.vx * dt;
      enemy.phase += dt;
      if (enemy.type === "bird") enemy.y = enemy.baseY + Math.sin(enemy.phase * 4.5) * 20;
    }
    if (state.flag) state.flag.x -= move;
    for (const cloud of state.clouds) {
      cloud.x -= move * 0.12;
      if (cloud.x < -160) cloud.x = CONFIG.width + random(80, 240);
    }
  }

  function updateCat(state, dt, realDt) {
    const cat = state.cat;
    cat.lastY = cat.y;
    if (cat.riding && state.platforms.indexOf(cat.riding) >= 0 && overlapsHorizontally(cat, cat.riding)) {
      cat.y = cat.riding.y - cat.height;
      if (cat.vy >= 0) cat.vy = 0;
    }
    cat.vy = Math.min(1600, cat.vy + CONFIG.gravity * dt);
    cat.y += cat.vy * dt;
    cat.grounded = false;
    cat.riding = null;

    const supports = state.platforms;
    for (const platform of supports) {
      if (!isLandingOn(cat, platform)) continue;
      land(state, platform);
      break;
    }

    for (const pipe of state.pipes) {
      if (cat.vy < 0 || cat.lastY + cat.height > pipe.y + 16) continue;
      if (cat.x + cat.width - 8 < pipe.x || cat.x + 8 > pipe.x + pipe.width) continue;
      if (cat.y + cat.height <= pipe.y + 18) {
        cat.y = pipe.y - cat.height;
        land(state, pipe);
      }
    }

    cat.x += (CONFIG.catX - cat.x) * Math.min(1, realDt * 7);
    cat.x = clamp(cat.x, 34, CONFIG.width - 220);
    cat.action = cat.grounded ? "run" : "jump";
    if (cat.grounded) {
      cat.stepTimer += realDt;
      if (cat.stepTimer > 0.16) {
        cat.stepTimer = 0;
        spawnDust(state, cat.x + 12, cat.y + cat.height, 1);
      }
    }
    if (state.dash > 0 || state.rocket > 0) spawnTrail(state);
  }

  function overlapsHorizontally(cat, platform) {
    return cat.x + cat.width > platform.x + 4 && cat.x < platform.x + platform.width - 4;
  }

  function land(state, platform) {
    const cat = state.cat;
    const wasAirborne = !cat.grounded;
    cat.y = platform.y - cat.height;
    cat.vy = 0;
    cat.grounded = true;
    cat.coyote = 0.11;
    cat.jumpsLeft = state.character.jumps;
    cat.riding = platform;
    if (wasAirborne) {
      cat.landFlash = 1;
      spawnDust(state, cat.x + 6, cat.y + cat.height, 5);
      if (state.slam > 0) triggerSlam(state);
      if (state.jumpBuffer > 0) {
        state.jumpBuffer = 0;
        jump(state);
      }
    }
  }

  function isLandingOn(cat, platform) {
    const previousBottom = cat.lastY + cat.height;
    const currentBottom = cat.y + cat.height;
    const horizontal = cat.x + cat.width > platform.x + 8 && cat.x < platform.x + platform.width - 8;
    return cat.vy >= 0 && horizontal && previousBottom <= platform.y + 16 && currentBottom >= platform.y;
  }

  /* ---------------------------------------------------------------- 拾取与碰撞 */

  function catBox(state) {
    const cat = state.cat;
    return { x: cat.x + 10, y: cat.y + 8, width: cat.width - 6, height: cat.height - 14 };
  }

  function collectPickups(state, dt, move) {
    const box = catBox(state);
    const magnet = state.magnet > 0;
    for (const coin of state.coinList) {
      if (magnet) {
        const dx = box.x - coin.x;
        const dy = box.y + 10 - coin.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 230 && dist > 1) {
          const pull = 640 * dt;
          coin.x += (dx / dist) * pull;
          coin.y += (dy / dist) * pull;
        }
      }
      if (!intersects(box, coin)) continue;
      coin.taken = true;
      if (coin.kind === "gem") {
        state.gems += 1;
        bumpCombo(state);
        addScore(state, SCORE.gem, coin.x, coin.y, `${SCORE.gem}`);
        burst(state, coin.x + 14, coin.y + 14, [126, 231, 255], 14);
        ns.audio.play("gem");
      } else {
        state.coins += 1;
        state.coinsSinceHeal += 1;
        bumpCombo(state);
        addScore(state, SCORE.coin, coin.x, coin.y, `+${SCORE.coin}`);
        burst(state, coin.x + 14, coin.y + 14, [255, 209, 102], 7);
        ns.audio.play("coin");
        if (state.coinsSinceHeal >= CONFIG.healCoinCount) {
          state.coinsSinceHeal = 0;
          healOne(state);
        }
      }
      state.pickupPulse = 1;
      state.coinPulse = coin.kind === "gem" ? 1.4 : 1;
    }
    state.coinList = state.coinList.filter((coin) => !coin.taken && coin.x + coin.width > -80);
    void move;

    for (const power of state.powerList) {
      if (!intersects(box, power)) continue;
      power.taken = true;
      applyPowerup(state, power);
    }
    state.powerList = state.powerList.filter((power) => !power.taken && power.x + power.width > -80);
  }

  function healOne(state) {
    if (state.lives < state.character.maxLives) {
      state.lives += 1;
      floatText(state, state.cat.x + 26, state.cat.y - 16, "生命 +1", [239, 71, 111]);
      ns.audio.play("heal");
      state.lifePulse = 1;
    } else {
      addScore(state, 30, state.cat.x + 26, state.cat.y - 16, "满血 +30");
      floatText(state, state.cat.x + 26, state.cat.y - 40, "生命已满", [255, 209, 102]);
      ns.audio.play("heal");
    }
  }

  function applyPowerup(state, power) {
    const def = POWERUPS[power.kind];
    state.stats.powers += 1;
    switch (power.kind) {
      case "magnet":
        state.magnet = def.duration;
        break;
      case "shield":
        state.shield = true;
        break;
      case "star":
        state.star = def.duration;
        break;
      case "rocket":
        state.rocket = def.duration;
        break;
      case "heart":
        if (state.lives < state.character.maxLives) state.lives += 1;
        else addScore(state, 60, power.x, power.y, "+60");
        state.lifePulse = 1;
        break;
      default:
        break;
    }
    addScore(state, def.score, power.x, power.y - 8, def.name);
    burst(state, power.x + 18, power.y + 18, def.color, 16);
    ringParticle(state, power.x + 18, power.y + 18, def.color);
    showToast(state, `${def.name}！`, def.color);
    ns.audio.play("power");
  }

  function handleHazards(state) {
    const box = catBox(state);
    const immune = state.star > 0 || state.dash > 0 || state.rocket > 0;

    if (!immune && state.cat.invincible <= 0) {
      for (const spike of state.spikes) {
        if (intersects(box, spike)) {
          damage(state, "spike");
          break;
        }
      }
    }

    for (const enemy of state.enemies) {
      if (!enemy.alive || !intersects(box, enemy)) continue;
      if (immune) {
        killEnemySmash(state, enemy);
        continue;
      }
      const window = enemy.type === "bird" ? 22 : 30;
      const stomping = enemy.stompable && state.cat.vy > 90 && box.y + box.height - enemy.y < window;
      if (stomping) stompEnemy(state, enemy);
      else damage(state, enemy.variant === "spike" ? "spikeEnemy" : "enemy");
      break;
    }

    if (immune) return;
    if (state.cat.invincible > 0) return;
    for (const pipe of state.pipes) {
      if (!intersects(box, pipe)) continue;
      if (state.cat.vy >= 0 && box.y + box.height - pipe.y < 16) continue;
      damage(state, "pipe");
      state.cat.x = Math.max(34, Math.min(state.cat.x, pipe.x - box.width - 6));
      break;
    }
  }

  function stompEnemy(state, enemy) {
    enemy.alive = false;
    state.stats.stomps += 1;
    const cat = state.cat;
    cat.vy = state.character.jumpVelocity * 0.68;
    cat.grounded = false;
    cat.riding = null;
    cat.action = "jump";
    cat.jumpsLeft = Math.max(cat.jumpsLeft, 1);
    ns.assets.resetPose();
    bumpCombo(state);
    addScore(state, SCORE.stomp, enemy.x + 18, enemy.y - 6, "踩!" );
    burst(state, enemy.x + enemy.width / 2, enemy.y + 8, [255, 255, 255], 10);
    ringParticle(state, enemy.x + enemy.width / 2, enemy.y + 10, [255, 183, 3]);
    state.shake = Math.max(state.shake, 6);
    ns.audio.play("stomp");
  }

  function killEnemySmash(state, enemy) {
    enemy.alive = false;
    bumpCombo(state);
    addScore(state, SCORE.smash, enemy.x + 16, enemy.y - 4, "撞碎");
    burst(state, enemy.x + enemy.width / 2, enemy.y + 10, [255, 138, 92], 12);
    state.shake = Math.max(state.shake, 5);
  }

  function trimWorld(state) {
    state.platforms = state.platforms.filter((p) => p.x + p.width > -160);
    state.pipes = state.pipes.filter((p) => p.x + p.width > -120);
    state.spikes = state.spikes.filter((s) => s.x + s.width > -120);
    state.enemies = state.enemies.filter((e) => e.alive && e.x + e.width > -140);
  }

  /* ---------------------------------------------------------------- 分数 / 连击 / 生命 */

  function addScore(state, base, x, y, label) {
    const gained = Math.round(base * state.multiplier * (state.star > 0 ? 2 : 1));
    state.score += gained;
    if (label !== false) floatText(state, x, y, label || `+${gained}`, base >= 100 ? [126, 231, 255] : [255, 214, 120]);
    return gained;
  }

  function bumpCombo(state) {
    state.combo += 1;
    state.comboTimer = CONFIG.comboWindow;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.multiplier = clamp(1 + Math.floor(state.combo / 4), 1, CONFIG.comboMax);
    if (state.combo > 3 && state.combo % 4 === 0) state.comboPulse = 1;
  }

  function damage(state, reason) {
    const cat = state.cat;
    if (state.mode !== "playing" || cat.invincible > 0) return false;
    if (state.star > 0 || state.dash > 0 || state.rocket > 0) return false;
    if (state.shield) {
      state.shield = false;
      cat.invincible = 1.1;
      state.flash = 0.5;
      state.shake = 10;
      burst(state, cat.x + 26, cat.y + 30, [139, 211, 255], 18);
      showToast(state, "护盾破碎！", [139, 211, 255]);
      ns.audio.play("power");
      return false;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    cat.invincible = CONFIG.invincibleSeconds;
    cat.vy = state.character.jumpVelocity * 0.4;
    cat.grounded = false;
    cat.riding = null;
    cat.action = "jump";
    state.flash = 1;
    state.shake = 14;
    state.lifePulse = 1;
    floatText(state, cat.x + 26, cat.y - 18, reason === "fall" ? "掉落 -1" : "受伤 -1", [255, 120, 120]);
    ns.audio.play(reason === "fall" ? "fall" : "hurt");
    if (state.lives <= 0) finishRun(state, false, reason);
    return true;
  }

  /* 掉进坑里不再原地反复掉血：传送回最近的可站立地块 */
  function rescueAfterFall(state) {
    if (state.mode !== "playing") return;
    const cat = state.cat;
    damage(state, "fall");
    if (state.mode !== "playing") return;
    state.stats.rescues += 1;
    const candidates = state.platforms
      .filter((p) => p.x + p.width > cat.x && p.y > CONFIG.groundY - 260)
      .sort((a, b) => a.x - b.x);
    const target = candidates[0];
    if (target) {
      cat.x = clamp(Math.max(cat.x, target.x + 16), 40, target.x + Math.max(16, target.width - 40));
      cat.y = target.y - cat.height - 4;
    } else {
      const rescue = { x: cat.x - 30, y: CONFIG.groundY - 60, width: 180, height: 26, type: "platform", baseY: CONFIG.groundY - 60, moving: false, amp: 0, speed: 0, phase: 0 };
      state.platforms.push(rescue);
      cat.x = rescue.x + 60;
      cat.y = rescue.y - cat.height;
    }
    cat.vy = 0;
    cat.grounded = true;
    cat.riding = null;
    cat.jumpsLeft = state.character.jumps;
    cat.action = "run";
    showToast(state, "救援弹台！", [255, 209, 102]);
  }

  /* ---------------------------------------------------------------- 操作 */

  function jump(state) {
    if (state.mode !== "playing") return;
    const cat = state.cat;
    if (cat.jumpsLeft <= 0) {
      state.jumpBuffer = 0.14;
      return;
    }
    /* 离地瞬间仍允许一次“地面跳”，避免擦边必死 */
    const first = cat.grounded || cat.coyote > 0;
    cat.coyote = 0;
    state.jumpBuffer = 0;
    cat.vy = state.character.jumpVelocity * (first ? 1 : 0.94);
    cat.grounded = false;
    cat.riding = null;
    cat.jumpsLeft -= 1;
    cat.action = "jump";
    ns.assets.resetPose();
    spawnDust(state, cat.x + 14, cat.y + cat.height, first ? 4 : 0);
    if (!first) burst(state, cat.x + 28, cat.y + cat.height - 6, [255, 255, 255], 5);
    ns.audio.play(first ? "jump" : "doubleJump");
  }

  function useSkill(state) {
    if (state.mode !== "playing") return;
    const skill = state.character.skill;
    if (state.skillCooldown > 0) {
      ns.audio.play("deny");
      showToast(state, `冷却 ${state.skillCooldown.toFixed(1)}s`, [200, 200, 220]);
      return;
    }
    state.skillCooldown = skill.cost;
    ns.audio.play("skill");
    state.shake = Math.max(state.shake, 6);
    if (skill.kind === "dash") {
      state.dash = skill.duration;
      state.cat.invincible = Math.max(state.cat.invincible, skill.duration);
      showToast(state, "疾影冲撞！", [77, 208, 255]);
    } else if (skill.kind === "slam") {
      state.slam = skill.duration + 1.2;
      state.cat.vy = Math.max(state.cat.vy, 520);
      showToast(state, "下次落地震击！", [255, 183, 3]);
    } else if (skill.kind === "slowmo") {
      state.slowmo = skill.duration;
      showToast(state, "时缓步伐…", [200, 182, 255]);
    }
    burst(state, state.cat.x + 28, state.cat.y + 34, hexToRgb(state.character.accent), 16);
  }

  function triggerSlam(state) {
    state.slam = 0;
    const cat = state.cat;
    const radius = 190;
    state.shake = 18;
    shockwave(state, cat.x + cat.width / 2, cat.y + cat.height);
    ns.audio.play("smash");
    let hits = 0;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = Math.abs(enemy.x + enemy.width / 2 - (cat.x + cat.width / 2));
      if (dx > radius) continue;
      enemy.alive = false;
      hits += 1;
      addScore(state, SCORE.smash, enemy.x + 14, enemy.y - 4, "震飞");
      burst(state, enemy.x + 16, enemy.y + 10, [255, 183, 3], 10);
    }
    if (hits) bumpCombo(state);
    showToast(state, hits ? `震地清场 x${hits}` : "震地！", [255, 183, 3]);
  }

  /* ---------------------------------------------------------------- 终点与 BOSS */

  function startFinish(state) {
    if (state.phase === "finish" || state.phase === "celebrate") return;
    state.phase = "finish";
    const startX = CONFIG.width - 60;
    state.platforms.push({ x: startX, y: CONFIG.groundY, width: 1600, height: 150, type: "ground" });
    state.enemies = state.enemies.filter((enemy) => enemy.x + enemy.width < state.cat.x);
    state.pipes = state.pipes.filter((pipe) => pipe.x + pipe.width < state.cat.x);
    state.spikes = state.spikes.filter((spike) => spike.x + spike.width < state.cat.x);
    state.flag = { x: CONFIG.width + 330, y: CONFIG.groundY - 178, height: 178, wave: 0, captured: false };
    state.nextChunkX = startX + 1600;
    showToast(state, "终点旗就在前方！", [47, 191, 113]);
  }

  function checkCapture(state, dt) {
    const flag = state.flag;
    flag.wave += dt;
    const cat = state.cat;
    if (flag.x + 46 < cat.x + cat.width) {
      flag.captured = true;
      state.phase = "celebrate";
      state.captureTimer = 1.35;
      state.mode = "capturing";
      state.score += SCORE.winBonus + SCORE.perLifeLeft * state.lives + SCORE.perGem * state.gems;
      state.shake = 12;
      burst(state, flag.x, flag.y + 30, [47, 191, 113], 26);
      for (let index = 0; index < 26; index += 1) {
        state.particles.push({
          type: "confetti",
          x: random(120, CONFIG.width - 60),
          y: random(-40, 120),
          vx: random(-40, 40),
          vy: random(70, 190),
          spin: random(-6, 6),
          angle: random(0, 6.28),
          size: random(6, 12),
          color: randomChoice([[255, 209, 102], [47, 191, 113], [244, 124, 72], [58, 134, 255], [239, 71, 111]]),
          life: 2.4,
          maxLife: 2.4,
        });
      }
      ns.audio.stopBgm();
      ns.audio.play("win");
    }
  }

  function startBoss(state) {
    if (state.phase !== "run" || !state.level.boss) return;
    state.phase = "boss";
    const cfg = state.level.boss;
    state.enemies = state.enemies.filter((enemy) => enemy.x + enemy.width < state.cat.x);
    state.pipes = [];
    state.spikes = [];
    state.platforms = state.platforms.filter((p) => p.type !== "ground");
    state.platforms.push({ x: -600, y: CONFIG.groundY, width: CONFIG.width + 1500, height: 150, type: "ground" });
    state.boss = {
      x: CONFIG.width + 150,
      y: CONFIG.groundY - 124,
      width: 132,
      height: 124,
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: "enter",
      timer: 0,
      hitFlash: 0,
      bob: 0,
      bombs: [],
      dir: -1,
    };
    showToast(state, "夺旗大盗的机械犬！", [255, 93, 93]);
    ns.audio.setBgmTrackForTheme("storm");
    state.flash = 0.6;
    state.shake = 16;
  }

  function updateBoss(state, dt) {
    const boss = state.boss;
    const cat = state.cat;
    boss.timer += dt;
    boss.hitFlash = Math.max(0, boss.hitFlash - dt * 3);
    boss.bob += dt * 3.4;

    if (boss.state === "dead") {
      if (boss.timer > 1.1) {
        state.boss = null;
        state.bossAt = null;
        state.nextEnemyDistance = state.distance + 400;
        state.nextBirdDistance = state.distance + 500;
        startFinish(state);
      }
      return;
    }

    if (boss.state === "enter") {
      boss.x -= 250 * dt;
      if (boss.x <= 596) {
        boss.x = 596;
        boss.state = "idle";
        boss.timer = 0;
      }
    } else if (boss.state === "idle") {
      if (boss.timer > 0.78) {
        boss.state = Math.random() < 0.62 ? "telegraph" : "bomb";
        boss.timer = 0;
      }
    } else if (boss.state === "telegraph") {
      if (boss.timer > 0.62) {
        boss.state = "charge";
        boss.timer = 0;
        state.shake = 8;
      }
    } else if (boss.state === "charge") {
      boss.x -= 470 * dt;
      spawnDust(state, boss.x + boss.width, CONFIG.groundY - 4, 1);
      if (boss.x < -170) {
        boss.x = CONFIG.width + 140;
        boss.state = "idle";
        boss.timer = 0;
      }
    } else if (boss.state === "bomb") {
      if (boss.timer > 0.3 && boss.timer < 0.34) throwBomb(state);
      if (boss.timer > 0.8 && boss.timer < 0.84) throwBomb(state);
      if (boss.timer > 1.25) {
        boss.state = "idle";
        boss.timer = 0;
      }
    } else if (boss.state === "hurt") {
      if (boss.timer > 0.55) {
        boss.state = "idle";
        boss.timer = 0;
      }
    }

    for (const bomb of boss.bombs) {
      bomb.vy += 1250 * dt;
      bomb.x += bomb.vx * dt;
      bomb.y += bomb.vy * dt;
      bomb.spin += dt * 6;
      if (bomb.y + bomb.size > CONFIG.groundY) {
        bomb.y = CONFIG.groundY - bomb.size;
        bomb.life = 0;
        burst(state, bomb.x, bomb.y, [255, 160, 90], 14);
        state.shake = Math.max(state.shake, 7);
        if (Math.abs(bomb.x - (cat.x + cat.width / 2)) < 90) damage(state, "bomb");
      }
    }
    boss.bombs = boss.bombs.filter((bomb) => bomb.life > 0 && bomb.x > -60);

    const box = catBox(state);
    const body = { x: boss.x + 6, y: boss.y + 10, width: boss.width - 12, height: boss.height - 10 };
    if (intersects(box, body)) {
      const stomp = cat.vy > 40 && box.y + box.height - boss.y < 58 && boss.state !== "telegraph";
      if (stomp) hitBoss(state);
      else damage(state, "boss");
    }
  }

  function throwBomb(state) {
    const boss = state.boss;
    const cat = state.cat;
    const startX = boss.x + 6;
    const startY = boss.y + 26;
    const dx = cat.x - startX;
    const flight = 1.05;
    boss.bombs.push({
      x: startX,
      y: startY,
      vx: dx / flight,
      vy: random(-620, -420),
      size: 16,
      life: 3,
      spin: 0,
    });
    ns.audio.play("jump");
  }

  function hitBoss(state) {
    const boss = state.boss;
    const cat = state.cat;
    boss.hp -= 1;
    boss.hitFlash = 1;
    boss.state = "hurt";
    boss.timer = 0;
    cat.vy = state.character.jumpVelocity * 0.82;
    cat.grounded = false;
    cat.jumpsLeft = Math.max(cat.jumpsLeft, 1);
    state.shake = 20;
    state.flash = 0.4;
    bumpCombo(state);
    addScore(state, 220, boss.x + 40, boss.y - 10, "重击!");
    burst(state, boss.x + boss.width / 2, boss.y + 14, [255, 214, 120], 20);
    ns.audio.play("bossHit");
    if (boss.hp <= 0) {
      boss.state = "dead";
      boss.timer = 0;
      state.score += 600;
      showToast(state, "机械犬被击毁！", [255, 209, 102]);
      for (let index = 0; index < 40; index += 1) {
        state.particles.push({
          type: "spark",
          x: boss.x + boss.width / 2,
          y: boss.y + boss.height / 2,
          vx: random(-320, 320),
          vy: random(-420, 60),
          size: random(4, 10),
          life: random(0.5, 1.1),
          maxLife: 1.1,
          color: randomChoice([[255, 183, 3], [255, 120, 90], [255, 255, 255]]),
        });
      }
    }
  }

  function finishRun(state, won, reason) {
    if (state.mode === "won" || state.mode === "lost") return;
    state.mode = won ? "won" : "lost";
    state.result = {
      won,
      reason,
      levelId: state.level.id,
      score: state.score,
      coins: state.coins,
      gems: state.gems,
      distance: Math.floor(state.distance),
      lives: Math.max(0, state.lives),
      bestCombo: state.bestCombo,
      time: state.time,
      stomps: state.stats.stomps,
      characterId: state.character.id,
      stars: computeStars(state, won),
    };
    if (!won) ns.audio.play("lose");
    ns.audio.stopBgm();
  }

  function computeStars(state, won) {
    if (!won) return 0;
    const thresholds = state.level.stars;
    let stars = 1;
    if (state.score >= thresholds[1]) stars = 2;
    if (state.score >= thresholds[2]) stars = 3;
    return stars;
  }

  /* ---------------------------------------------------------------- 粒子 */

  function push(state, particle) {
    particle.maxLife = particle.maxLife || particle.life;
    state.particles.push(particle);
    if (state.particles.length > MAX_PARTICLES) state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }

  function floatText(state, x, y, text, color) {
    push(state, { type: "text", x, y, text, color: color || [255, 214, 120], life: 0.85, vy: -52 });
  }

  function burst(state, x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(60, 220);
      push(state, {
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: random(3, 7),
        color,
        life: random(0.26, 0.6),
      });
    }
  }

  function ringParticle(state, x, y, color) {
    push(state, { type: "ring", x, y, radius: 8, color: color || [255, 183, 3], life: 0.42 });
  }

  function shockwave(state, x, y) {
    push(state, { type: "shock", x, y, radius: 12, life: 0.55, color: [255, 183, 3] });
    spawnDust(state, x - 40, y, 10);
  }

  function spawnDust(state, x, y, count) {
    for (let index = 0; index < count; index += 1) {
      push(state, {
        type: "dust",
        x: x + random(-6, 6),
        y,
        vx: random(-120, -30),
        vy: random(-70, -14),
        size: random(4, 9),
        life: random(0.2, 0.44),
        color: [255, 247, 224],
      });
    }
  }

  function spawnTrail(state) {
    const cat = state.cat;
    push(state, {
      type: "trail",
      x: cat.x + 8,
      y: cat.y + random(10, cat.height - 12),
      size: random(8, 16),
      life: 0.24,
      color: state.rocket > 0 ? [255, 138, 92] : [77, 208, 255],
    });
  }

  function updateParticles(state, dt) {
    for (const p of state.particles) {
      p.life -= dt;
      if (p.type === "spark" || p.type === "dust") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.type === "dust" ? 240 : 320) * dt;
      } else if (p.type === "text") {
        p.y += (p.vy || -46) * dt;
      } else if (p.type === "ring") {
        p.radius += 120 * dt;
      } else if (p.type === "shock") {
        p.radius += 420 * dt;
      } else if (p.type === "confetti") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }
    }
    state.particles = state.particles.filter((p) => p.life > 0 && p.y < CONFIG.height + 60);
  }

  function showToast(state, text, color) {
    state.toast = text;
    state.toastColor = color || [255, 255, 255];
    state.toastTimer = 1.6;
  }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }

  ns.world = {
    createRun,
    update,
    jump,
    useSkill,
    finishRun,
    computeStars,
    catBox,
    PX_PER_M,
  };
})(window.DQM);
