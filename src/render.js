/* 夺旗猫跑酷 · 渲染层：主题视差背景、地形、实体、特效、画布内提示 */
(function (ns) {
  const { CONFIG } = ns;
  const clamp = ns.utils.clamp;
  let ctx = null;
  let skyCache = { theme: null, gradient: null };
  let ambient = [];
  let ambientTheme = null;
  let clock = 0;

  function init(canvas) {
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
  }

  function rect(x, y, width, height) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function rgb(color, alpha) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha === undefined ? 1 : alpha})`;
  }

  function draw(state, dt) {
    if (!ctx) return;
    clock += dt;
    const theme = state.theme;
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.save();
    if (state.shake > 0.4) {
      const amount = Math.min(9, state.shake * 0.6);
      ctx.translate(Math.round(ns.utils.random(-amount, amount)), Math.round(ns.utils.random(-amount, amount)));
    }
    drawSky(state, theme);
    drawParallax(state, theme);
    drawGround(state, theme);
    drawPipes(state, theme);
    drawSpikes(state);
    drawCoins(state);
    drawPowerups(state);
    drawEnemies(state, theme);
    if (state.boss) drawBoss(state);
    drawFlag(state);
    drawParticles(state);
    drawCat(state);
    ctx.restore();
    drawAmbient(state, theme);
    drawVignette(state, theme);
    if (state.flash > 0.02) {
      ctx.fillStyle = `rgba(255, 60, 60, ${Math.min(0.4, state.flash * 0.34)})`;
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }
    drawOverlayText(state);
  }

  /* ------------------------------------------------------------------ 背景 */

  function drawSky(state, theme) {
    if (skyCache.theme !== theme.id) {
      const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
      for (const [stop, color] of theme.sky) gradient.addColorStop(stop, color);
      skyCache = { theme: theme.id, gradient };
    }
    ctx.fillStyle = skyCache.gradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    if (theme.stars) {
      for (let index = 0; index < 60; index += 1) {
        const x = (ns.utils.hash(index) * 1000 + state.distance * 0.35) % CONFIG.width;
        const y = ns.utils.hash(index + 90) * 260;
        const twinkle = 0.35 + Math.abs(Math.sin(clock * 1.6 + index)) * 0.65;
        ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.7})`;
        rect(x, y, 2, 2);
      }
    }

    const sun = theme.sun;
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, sun.r * 3.4);
    glow.addColorStop(0, sun.color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - sun.r * 4, sun.y - sun.r * 4, sun.r * 8, sun.r * 8);
    ctx.fillStyle = sun.color;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
    ctx.fill();

    for (const cloud of state.clouds) drawCloud(cloud, theme);
  }

  function drawCloud(cloud, theme) {
    const dark = theme.stars ? "rgba(200,215,255,0.24)" : "rgba(255,255,255,0.88)";
    ctx.fillStyle = dark;
    rect(cloud.x, cloud.y, 42 * cloud.scale, 18 * cloud.scale);
    rect(cloud.x + 18 * cloud.scale, cloud.y - 16 * cloud.scale, 52 * cloud.scale, 34 * cloud.scale);
    rect(cloud.x + 60 * cloud.scale, cloud.y - 2 * cloud.scale, 42 * cloud.scale, 20 * cloud.scale);
  }

  function drawParallax(state, theme) {
    const far = -(state.distance * 2.4) % 360;
    ctx.fillStyle = theme.hills[0];
    for (let index = -1; index < 5; index += 1) {
      const x = far + index * 360;
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.groundY);
      ctx.lineTo(x + 178, 214);
      ctx.lineTo(x + 360, CONFIG.groundY);
      ctx.closePath();
      ctx.fill();
    }

    const mid = -(state.distance * 5) % 300;
    ctx.fillStyle = theme.hills[1];
    for (let index = -1; index < 6; index += 1) {
      const x = mid + index * 300;
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.groundY);
      ctx.lineTo(x + 145, 240);
      ctx.lineTo(x + 300, CONFIG.groundY);
      ctx.closePath();
      ctx.fill();
    }

    drawCity(state, theme);
    drawProps(state, theme);
  }

  function drawCity(state, theme) {
    const rate = theme.city.rate;
    const offset = -((state.distance * 7) % rate);
    const base = ns.utils.hash;
    for (let index = -1; index < Math.ceil(CONFIG.width / rate) + 2; index += 1) {
      const seed = Math.floor((state.distance * 7) / rate) + index;
      const h = 90 + base(seed * 1.7) * 190;
      const w = 60 + base(seed * 3.1) * 46;
      const x = offset + index * rate + base(seed * 5.3) * 24;
      const y = CONFIG.groundY - h;
      ctx.fillStyle = theme.city.body;
      rect(x, y, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      rect(x + w - 8, y, 8, h);
      for (let row = y + 12; row < CONFIG.groundY - 18; row += 24) {
        for (let column = x + 10; column < x + w - 14; column += 20) {
          const lit = base(column * 0.31 + row * 0.17 + seed) > (theme.stars ? 0.42 : 0.78);
          ctx.fillStyle = lit ? theme.city.lit : "rgba(255,255,255,0.06)";
          rect(column, row, 10, 12);
        }
      }
    }
  }

  function drawProps(state, theme) {
    const rate = 260;
    const offset = -((state.distance * 13) % rate);
    for (let index = -1; index < Math.ceil(CONFIG.width / rate) + 2; index += 1) {
      const seed = Math.floor((state.distance * 13) / rate) + index;
      const x = offset + index * rate + ns.utils.hash(seed * 2.3) * 60;
      const kind = theme.prop;
      if (kind === "tree") drawTree(x, theme, seed);
      else if (kind === "fountain") drawFountain(x, theme, seed);
      else if (kind === "sign") drawSign(x, theme, seed);
      else if (kind === "crane") drawCrane(x, theme, seed);
      else if (kind === "roof") drawRoof(x, theme, seed);
      else if (kind === "tower") drawTower(x, theme, seed);
    }
  }

  function drawTree(x, theme, seed) {
    const scale = 0.8 + ns.utils.hash(seed) * 0.5;
    ctx.fillStyle = "rgba(90,60,30,0.55)";
    rect(x + 16 * scale, CONFIG.groundY - 60 * scale, 10 * scale, 60 * scale);
    ctx.fillStyle = theme.propColor[0];
    rect(x, CONFIG.groundY - 108 * scale, 44 * scale, 44 * scale);
    ctx.fillStyle = theme.propColor[1];
    rect(x + 8 * scale, CONFIG.groundY - 128 * scale, 28 * scale, 26 * scale);
  }

  function drawFountain(x, theme, seed) {
    const pulse = Math.sin(clock * 2 + seed) * 6;
    ctx.fillStyle = theme.propColor[0];
    rect(x, CONFIG.groundY - 34, 74, 34);
    ctx.fillStyle = theme.propColor[1];
    rect(x + 12, CONFIG.groundY - 62 - pulse * 0.4, 50, 30);
    ctx.fillStyle = "rgba(200,240,255,0.65)";
    rect(x + 33, CONFIG.groundY - 96 - pulse, 8, 40 + pulse);
  }

  function drawSign(x, theme, seed) {
    ctx.fillStyle = "rgba(20,24,48,0.9)";
    rect(x + 20, CONFIG.groundY - 150, 10, 150);
    const flicker = 0.55 + Math.abs(Math.sin(clock * 5 + seed * 3)) * 0.45;
    ctx.fillStyle = rgb(hexColor(theme.propColor[0]), flicker);
    rect(x, CONFIG.groundY - 210, 78, 46);
    ctx.fillStyle = rgb(hexColor(theme.propColor[1]), flicker);
    rect(x + 10, CONFIG.groundY - 200, 58, 8);
    rect(x + 10, CONFIG.groundY - 184, 34, 8);
  }

  function drawCrane(x, theme, seed) {
    const swing = Math.sin(clock * 0.7 + seed) * 16;
    ctx.fillStyle = theme.propColor[0];
    rect(x + 30, CONFIG.groundY - 250, 14, 250);
    rect(x - 30, CONFIG.groundY - 258, 170, 12);
    ctx.fillStyle = theme.propColor[1];
    rect(x + 60, CONFIG.groundY - 246, 6, 60 + swing);
    rect(x + 52, CONFIG.groundY - 190 + swing, 22, 18);
    for (let y = CONFIG.groundY - 240; y < CONFIG.groundY - 20; y += 34) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      rect(x + 30, y, 14, 6);
    }
  }

  function drawRoof(x, theme, seed) {
    const h = 120 + ns.utils.hash(seed) * 90;
    ctx.fillStyle = theme.propColor[0];
    rect(x, CONFIG.groundY - h, 130, h);
    ctx.fillStyle = theme.propColor[1];
    rect(x + 12, CONFIG.groundY - h - 16, 40, 16);
    for (let row = CONFIG.groundY - h + 18; row < CONFIG.groundY - 14; row += 26) {
      for (let column = x + 14; column < x + 118; column += 26) {
        const lit = ns.utils.hash(column + row * 0.7 + seed) > 0.5;
        ctx.fillStyle = lit ? "rgba(255,224,138,0.85)" : "rgba(255,255,255,0.06)";
        rect(column, row, 12, 14);
      }
    }
  }

  function drawTower(x, theme, seed) {
    const h = 150 + ns.utils.hash(seed) * 120;
    ctx.fillStyle = "rgba(28,12,22,0.9)";
    rect(x, CONFIG.groundY - h, 96, h);
    ctx.fillStyle = theme.propColor[0];
    rect(x + 34, CONFIG.groundY - h - 40, 8, 40);
    const pulse = 0.4 + Math.abs(Math.sin(clock * 3 + seed)) * 0.6;
    ctx.fillStyle = rgb(hexColor(theme.propColor[1]), pulse);
    ctx.beginPath();
    ctx.arc(x + 38, CONFIG.groundY - h - 44, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function hexColor(hex) {
    if (Array.isArray(hex)) return hex;
    const value = hex.replace("#", "");
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }

  function drawAmbient(state, theme) {
    if (ambientTheme !== theme.id) {
      ambientTheme = theme.id;
      ambient = Array.from({ length: 54 }, (_, index) => ({
        x: ns.utils.hash(index * 1.7) * CONFIG.width,
        y: ns.utils.hash(index * 3.3) * CONFIG.height,
        speed: 30 + ns.utils.hash(index * 5.1) * 90,
        size: 2 + ns.utils.hash(index * 7.7) * 4,
        drift: ns.utils.hash(index * 9.1) * 2 - 1,
      }));
    }
    ctx.fillStyle = theme.ambientColor;
    for (const flake of ambient) {
      flake.y += flake.speed * 0.016;
      flake.x += flake.drift * 0.6 - (state.effSpeed || 0) * 0.006;
      if (flake.y > CONFIG.height) {
        flake.y = -8;
        flake.x = Math.random() * CONFIG.width;
      }
      if (flake.x < -8) flake.x = CONFIG.width + 8;
      if (theme.ambient === "rain" || theme.ambient === "ember") rect(flake.x, flake.y, flake.size * 0.6, flake.size * 2.4);
      else rect(flake.x, flake.y, flake.size, flake.size);
    }
  }

  function drawVignette(state, theme) {
    const gradient = ctx.createRadialGradient(CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.42, CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.96);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, theme.fog);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    if (state.slowmo > 0) {
      ctx.fillStyle = `rgba(180,160,255,${Math.min(0.16, state.slowmo * 0.06)})`;
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }
  }

  /* ------------------------------------------------------------------ 地形 */

  function drawGround(state, theme) {
    for (const platform of state.platforms) {
      if (platform.x > CONFIG.width + 40 || platform.x + platform.width < -40) continue;
      if (platform.type !== "ground") {
        drawFloatPlatform(platform, theme);
        continue;
      }
      const g = theme.ground;
      ctx.fillStyle = g.top;
      rect(platform.x, platform.y - 8, platform.width, 10);
      ctx.fillStyle = g.body;
      rect(platform.x, platform.y, platform.width, platform.height);
      ctx.fillStyle = g.blade;
      for (let x = platform.x + 6; x < platform.x + platform.width; x += 24) rect(x, platform.y - 14, 12, 8);
      ctx.fillStyle = g.lip;
      rect(platform.x, platform.y + 22, platform.width, 12);
      ctx.fillStyle = g.dirt;
      rect(platform.x, platform.y + 38, platform.width, platform.height - 38);
      ctx.fillStyle = g.pebble;
      for (let x = platform.x; x < platform.x + platform.width; x += 48) {
        rect(x + 8, platform.y + 54, 20, 10);
        rect(x + 28, platform.y + 82, 16, 8);
      }
      ctx.fillStyle = "rgba(255,240,188,0.18)";
      for (let x = platform.x + 18; x < platform.x + platform.width; x += 86) rect(x, platform.y + 52, 10, 10);
    }
  }

  function drawFloatPlatform(platform, theme) {
    const p = theme.platform;
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    rect(platform.x + 4, platform.y + platform.height, platform.width - 8, 6);
    ctx.fillStyle = p.body;
    rect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = p.top;
    rect(platform.x, platform.y, platform.width, 6);
    ctx.fillStyle = p.edge;
    rect(platform.x, platform.y + platform.height - 7, platform.width, 7);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    for (let x = platform.x + 12; x < platform.x + platform.width - 8; x += 34) rect(x, platform.y + 11, 14, 5);
    if (platform.moving) {
      ctx.fillStyle = "rgba(255,209,102,0.9)";
      rect(platform.x + platform.width / 2 - 9, platform.y - 9, 4, 6);
      rect(platform.x + platform.width / 2 + 5, platform.y - 9, 4, 6);
      rect(platform.x + platform.width / 2 - 3, platform.y - 13, 6, 4);
    }
  }

  function drawPipes(state, theme) {
    for (const pipe of state.pipes) {
      if (pipe.x > CONFIG.width + 40 || pipe.x + pipe.width < -40) continue;
      ctx.fillStyle = theme.pipe.body;
      rect(pipe.x, pipe.y, pipe.width, pipe.height + 10);
      ctx.fillStyle = theme.pipe.cap;
      rect(pipe.x - 8, pipe.y, pipe.width + 16, 18);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      rect(pipe.x - 8, pipe.y + 14, pipe.width + 16, 4);
      ctx.fillStyle = theme.pipe.gloss;
      rect(pipe.x + 10, pipe.y + 24, 10, pipe.height - 26);
    }
  }

  function drawSpikes(state) {
    for (const spike of state.spikes) {
      if (spike.x > CONFIG.width + 40 || spike.x + spike.width < -40) continue;
      const count = Math.max(2, Math.round(spike.width / 14));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      rect(spike.x - 2, spike.y + spike.height - 4, spike.width + 4, 6);
      for (let index = 0; index < count; index += 1) {
        const x = spike.x + (index * spike.width) / count;
        const w = spike.width / count;
        ctx.fillStyle = "#c9d4e3";
        ctx.beginPath();
        ctx.moveTo(x, spike.y + spike.height);
        ctx.lineTo(x + w / 2, spike.y - 8);
        ctx.lineTo(x + w, spike.y + spike.height);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#8b97ab";
        ctx.beginPath();
        ctx.moveTo(x + w / 2, spike.y - 8);
        ctx.lineTo(x + w, spike.y + spike.height);
        ctx.lineTo(x + w / 2, spike.y + spike.height);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------------ 实体 */

  function drawCoins(state) {
    const now = performance.now();
    state.coinList.forEach((coin, index) => {
      if (coin.x > CONFIG.width + 40 || coin.x + coin.width < -40) return;
      const bob = Math.sin(now / 180 + coin.x * 0.01) * 4;
      const cx = coin.x + coin.width / 2;
      const cy = coin.y + coin.height / 2 + bob;
      const glow = 0.4 + Math.abs(Math.sin(now / 190 + index)) * 0.35;
      if (coin.kind === "gem") {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(now / 400 + index) * 0.2);
        ctx.fillStyle = `rgba(126,231,255,${glow})`;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5ec8ff";
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(13, -2);
        ctx.lineTo(0, 17);
        ctx.lineTo(-13, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(6, -4);
        ctx.lineTo(0, -2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.fillStyle = `rgba(255, 209, 102, ${glow})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      const frame = ns.assets.coinFrame(0);
      if (frame) {
        ctx.imageSmoothingEnabled = false;
        const squash = Math.max(0.3, Math.abs(Math.cos(now / 160 + coin.x * 0.01)));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(squash, 1);
        ctx.drawImage(frame, -20, -20, 40, 40);
        ctx.restore();
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.fillStyle = "#ffcc22";
        rect(cx - 11, cy - 13, 22, 26);
      }
    });
  }

  function drawPowerups(state) {
    for (const power of state.powerList) {
      if (power.x > CONFIG.width + 50 || power.x + power.width < -50) continue;
      const def = ns.POWERUPS[power.kind];
      const cy = power.y + Math.sin(power.spin * 2) * 5;
      const cx = power.x + power.width / 2;
      ctx.save();
      ctx.translate(cx, cy + 18);
      const pulse = 0.55 + Math.abs(Math.sin(power.spin * 1.6)) * 0.45;
      ctx.fillStyle = rgb(def.color, 0.22 * pulse);
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(def.color, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      drawPowerGlyph(power.kind);
      ctx.restore();
    }
  }

  function drawPowerGlyph(kind) {
    ctx.fillStyle = "#172033";
    if (kind === "magnet") {
      rect(-8, -8, 6, 14);
      rect(2, -8, 6, 14);
      rect(-8, -10, 16, 5);
      ctx.fillStyle = "#e0556b";
      rect(-8, 4, 6, 4);
      rect(2, 4, 6, 4);
    } else if (kind === "shield") {
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, -5);
      ctx.lineTo(9, 4);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, 4);
      ctx.lineTo(-9, -5);
      ctx.closePath();
      ctx.fill();
    } else if (kind === "star") {
      ctx.beginPath();
      for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 === 0 ? 11 : 5;
        const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx[index === 0 ? "moveTo" : "lineTo"](x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === "heart") {
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.bezierCurveTo(-14, -1, -7, -12, 0, -4);
      ctx.bezierCurveTo(7, -12, 14, -1, 0, 9);
      ctx.fill();
    } else {
      rect(-3, -11, 6, 16);
      ctx.beginPath();
      ctx.moveTo(-3, -11);
      ctx.lineTo(0, -16);
      ctx.lineTo(3, -11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f47c48";
      rect(-5, 5, 10, 6);
    }
  }

  function drawEnemies(state, theme) {
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.x > CONFIG.width + 60 || enemy.x + enemy.width < -60) continue;
      const bob = Math.sin(enemy.phase * 8) * 2;
      if (enemy.type === "bird") drawBird(enemy, bob);
      else drawWalker(enemy, bob, theme);
    }
  }

  function outline(x, y, width, height) {
    ctx.fillStyle = "#172033";
    rect(x - 3, y + 4, width + 6, height - 2);
  }

  function eyes(x, y, size, gap) {
    ctx.fillStyle = "#fff1d0";
    rect(x, y, size, size);
    rect(x + gap, y, size, size);
    ctx.fillStyle = "#172033";
    rect(x + 3, y + 3, size - 4, size - 4);
    rect(x + gap + 3, y + 3, size - 4, size - 4);
  }

  function drawWalker(enemy, bob, theme) {
    const y = enemy.y + bob;
    if (enemy.variant === "spike") {
      outline(enemy.x, y + 7, enemy.width, enemy.height);
      ctx.fillStyle = "#5b2b6f";
      rect(enemy.x, y + 8, enemy.width, enemy.height - 8);
      ctx.fillStyle = "#d7c4ff";
      for (let x = enemy.x + 4; x < enemy.x + enemy.width - 4; x += 12) rect(x, y - 2, 8, 11);
      eyes(enemy.x + 9, y + 18, 8, 20);
      ctx.fillStyle = "rgba(255,90,90,0.9)";
      rect(enemy.x + 4, y + enemy.height - 6, enemy.width - 8, 4);
      return;
    }
    if (enemy.variant === "shield") {
      outline(enemy.x, y + 3, enemy.width, enemy.height);
      ctx.fillStyle = "#31566f";
      rect(enemy.x, y + 4, enemy.width, enemy.height - 4);
      ctx.fillStyle = "#8bd3ff";
      rect(enemy.x + 7, y + 8, enemy.width - 14, enemy.height - 15);
      eyes(enemy.x + 15, y + 16, 6, 15);
      ctx.fillStyle = "#18364a";
      rect(enemy.x + 9, y + enemy.height - 7, 12, 7);
      rect(enemy.x + 30, y + enemy.height - 7, 12, 7);
      return;
    }
    if (enemy.variant === "sprinter") {
      ctx.fillStyle = "rgba(217,79,53,0.28)";
      rect(enemy.x + enemy.width, y + 8, 26, 6);
      rect(enemy.x + enemy.width + 10, y + 18, 18, 5);
      outline(enemy.x, y + 6, enemy.width, enemy.height);
      ctx.fillStyle = "#d94f35";
      rect(enemy.x, y + 4, enemy.width, enemy.height - 4);
      ctx.fillStyle = "#ffb86b";
      rect(enemy.x + 5, y + 8, enemy.width - 10, 8);
      eyes(enemy.x + 7, y + 15, 7, 16);
      ctx.fillStyle = "#7c2418";
      rect(enemy.x + 2, y + enemy.height - 4, 13, 6);
      rect(enemy.x + 23, y + enemy.height - 4, 13, 6);
      return;
    }
    outline(enemy.x, y + 4, enemy.width, enemy.height);
    ctx.fillStyle = theme.ground.dirt;
    rect(enemy.x, y, enemy.width, enemy.height);
    ctx.fillStyle = "#a94a38";
    rect(enemy.x + 5, y + 5, enemy.width - 10, 12);
    eyes(enemy.x + 8, y + 10, 9, 17);
    ctx.fillStyle = "#4b241e";
    rect(enemy.x + 8, y + enemy.height - 5, 10, 7);
    rect(enemy.x + 25, y + enemy.height - 5, 10, 7);
  }

  function drawBird(enemy, bob) {
    const wing = Math.sin(enemy.phase * 12) > 0 ? -8 : 4;
    const y = enemy.y + bob;
    ctx.fillStyle = "#172033";
    rect(enemy.x + 7, y + 11, 36, 20);
    ctx.fillStyle = "#2b3856";
    rect(enemy.x + 9, y + 10, 32, 18);
    ctx.fillStyle = "#4f68a8";
    rect(enemy.x - 3, y + 8 + wing, 22, 9);
    rect(enemy.x + 31, y + 8 + wing, 22, 9);
    ctx.fillStyle = "#86a8ff";
    rect(enemy.x + 14, y + 14, 10, 6);
    ctx.fillStyle = "#ffe8a3";
    rect(enemy.x + 39, y + 15, 11, 6);
    ctx.fillStyle = "#fff1d0";
    rect(enemy.x + 28, y + 13, 6, 6);
    ctx.fillStyle = "#172033";
    rect(enemy.x + 30, y + 15, 3, 3);
  }

  function drawBoss(state) {
    const boss = state.boss;
    const y = boss.y + Math.sin(boss.bob) * (boss.state === "charge" ? 2 : 5);
    const hit = boss.hitFlash > 0;
    ctx.fillStyle = "rgba(23,32,51,0.28)";
    ctx.beginPath();
    ctx.ellipse(boss.x + boss.width / 2, CONFIG.groundY + 6, boss.width * 0.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyColor = boss.state === "telegraph" ? "#ff5d5d" : hit ? "#ffffff" : "#43506b";
    ctx.fillStyle = "#172033";
    rect(boss.x - 4, y + 8, boss.width + 8, boss.height - 4);
    ctx.fillStyle = bodyColor;
    rect(boss.x, y + 12, boss.width, boss.height - 16);
    ctx.fillStyle = hit ? "#ffd166" : "#5d6d8f";
    rect(boss.x + 12, y + 2, boss.width - 34, 22);
    ctx.fillStyle = "#2b3350";
    rect(boss.x + boss.width - 34, y - 12, 30, 26);
    const eye = boss.state === "charge" ? "#ff3b3b" : boss.state === "telegraph" ? "#ffd166" : "#7ff0c8";
    ctx.fillStyle = eye;
    rect(boss.x + boss.width - 28, y - 6, 18, 8);
    ctx.fillStyle = "#172033";
    rect(boss.x + 10, y + boss.height - 18, 22, 18);
    rect(boss.x + boss.width - 34, y + boss.height - 18, 22, 18);
    ctx.fillStyle = "#8b95ad";
    for (let x = boss.x + 8; x < boss.x + boss.width - 12; x += 18) rect(x, y + 34, 10, 8);
    if (boss.state === "dead") {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.abs(Math.sin(clock * 12)) * 0.6})`;
      rect(boss.x - 6, y, boss.width + 12, boss.height);
    }

    for (const bomb of boss.bombs) {
      const drop = Math.max(0, CONFIG.groundY - (bomb.y + bomb.size));
      const fall = (-bomb.vy + Math.sqrt(bomb.vy * bomb.vy + 2 * 1850 * drop)) / 1850;
      const impact = bomb.x + bomb.vx * fall;
      if (impact > -40 && impact < CONFIG.width + 40) {
        const pulse = 0.35 + Math.abs(Math.sin(clock * 7)) * 0.4;
        ctx.strokeStyle = `rgba(255,93,93,${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(impact, CONFIG.groundY + 2, 22 * pulse + 10, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const bomb of boss.bombs) {
      ctx.save();
      ctx.translate(bomb.x, bomb.y);
      ctx.rotate(bomb.spin);
      ctx.fillStyle = "#22283c";
      ctx.beginPath();
      ctx.arc(0, 0, bomb.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8a5c";
      rect(-2, -bomb.size - 6, 4, 7);
      ctx.restore();
    }

    drawBossHp(state, boss);
  }

  function drawBossHp(state, boss) {
    const width = 320;
    const x = (CONFIG.width - width) / 2;
    const y = 64;
    ctx.fillStyle = "rgba(23,32,51,0.55)";
    rect(x - 4, y - 4, width + 8, 26);
    ctx.fillStyle = "#3b2130";
    rect(x, y, width, 18);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "#ff5d5d");
    gradient.addColorStop(1, "#ffb703");
    ctx.fillStyle = gradient;
    rect(x, y, width * ratio, 18);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("机械犬 · 跳踩头部三次", CONFIG.width / 2, y + 34);
  }

  function drawFlag(state) {
    const flag = state.flag;
    if (!flag) return;
    const wave = Math.sin(flag.wave * 3) * 6;
    const baseY = CONFIG.groundY;
    ctx.fillStyle = "rgba(23,32,51,0.25)";
    ctx.beginPath();
    ctx.ellipse(flag.x + 8, baseY + 4, 40, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cfd8e3";
    rect(flag.x, baseY - flag.height, 9, flag.height);
    ctx.fillStyle = "#8b95ad";
    rect(flag.x - 8, baseY - 12, 26, 12);
    const flutter = flag.captured ? 12 : 0;
    ctx.fillStyle = flag.captured ? "#ffd166" : "#2fbf71";
    ctx.beginPath();
    ctx.moveTo(flag.x + 9, baseY - flag.height + 6 + flutter);
    ctx.lineTo(flag.x + 96 + wave, baseY - flag.height + 26 + flutter);
    ctx.lineTo(flag.x + 9, baseY - flag.height + 48 + flutter);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(flag.x + 9, baseY - flag.height + 6 + flutter);
    ctx.lineTo(flag.x + 60 + wave * 0.6, baseY - flag.height + 18 + flutter);
    ctx.lineTo(flag.x + 9, baseY - flag.height + 22 + flutter);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(flag.captured ? "夺旗成功!" : "终点旗", flag.x + 10, baseY - flag.height - 12);
  }

  function drawParticles(state) {
    ctx.textAlign = "center";
    for (const p of state.particles) {
      const alpha = clamp01(p.life / (p.maxLife || 1));
      if (p.type === "spark" || p.type === "dust") {
        ctx.fillStyle = rgb(p.color || [255, 183, 3], alpha * (p.type === "dust" ? 0.6 : 1));
        rect(p.x, p.y, p.size, p.size);
      } else if (p.type === "ring") {
        ctx.strokeStyle = rgb(p.color || [255, 183, 3], alpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "shock") {
        ctx.strokeStyle = rgb([255, 183, 3], alpha);
        ctx.lineWidth = 6 * alpha;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "trail") {
        ctx.fillStyle = rgb(p.color || [77, 208, 255], alpha * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = rgb(p.color, alpha);
        rect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.font = "bold 21px system-ui";
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(23,32,51,${alpha * 0.85})`;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = rgb(p.color || [255, 214, 120], alpha);
        ctx.fillText(p.text, p.x, p.y);
      }
    }
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  /* ------------------------------------------------------------------ 角色 */

  function drawCat(state) {
    const cat = state.cat;
    const blink = cat.invincible > 0 && state.mode === "playing" && Math.floor(cat.invincible * 16) % 2 === 0;
    const vy = cat.vy;
    const stretch = cat.grounded ? 1 - cat.landFlash * 0.12 : clamp(1 + Math.abs(vy) / 5200, 0.94, 1.1);
    const squash = cat.grounded ? 1 + cat.landFlash * 0.14 : clamp(1 - Math.abs(vy) / 6200, 0.9, 1.06);
    const lean = cat.grounded ? 0 : clamp(vy / 5200, -0.12, 0.14);

    drawCatShadow(state);
    ctx.save();
    ctx.translate(Math.round(cat.x + cat.width / 2), Math.round(cat.y + cat.height / 2));
    ctx.rotate(lean);
    ctx.scale(stretch, squash);
    if (state.star > 0) drawStarAura();
    if (state.magnet > 0) drawMagnetAura();
    if (state.shield) drawShield();
    if (state.slam > 0) drawSlamCharge();
    if (blink) ctx.globalAlpha = 0.42;
    if (state.dash > 0 || state.rocket > 0) drawSpeedLines(state);

    const image = ns.assets.catFrame(state.character, cat.action);
    if (image) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, -47, -50, 94, 100);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.fillStyle = "#172033";
      rect(-27, -23, 54, 46);
      ctx.fillStyle = state.character.accent;
      rect(-22, -18, 44, 36);
      ctx.fillStyle = "#fff";
      rect(6, -12, 8, 8);
      rect(-14, -12, 8, 8);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCatShadow(state) {
    const cat = state.cat;
    let supportY = CONFIG.groundY;
    for (const platform of state.platforms) {
      if (cat.x + cat.width > platform.x && cat.x < platform.x + platform.width && platform.y >= cat.y + cat.height - 6) {
        supportY = Math.min(supportY, platform.y);
      }
    }
    const heightFromGround = Math.max(0, supportY - (cat.y + cat.height));
    const width = Math.max(22, 52 - heightFromGround * 0.14);
    const alpha = Math.max(0.06, 0.24 - heightFromGround * 0.0016);
    ctx.fillStyle = `rgba(23, 32, 51, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cat.x + cat.width / 2, supportY + 4, width, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStarAura() {
    const pulse = 40 + Math.abs(Math.sin(clock * 6)) * 8;
    const colors = [[255, 93, 93], [255, 209, 102], [77, 208, 255]];
    for (let index = 0; index < 3; index += 1) {
      ctx.strokeStyle = rgb(colors[index], 0.5 - index * 0.12);
      ctx.lineWidth = 4 - index;
      ctx.beginPath();
      ctx.arc(0, 0, pulse + index * 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMagnetAura() {
    ctx.strokeStyle = `rgba(77,208,255,${0.25 + Math.abs(Math.sin(clock * 3)) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -clock * 40;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawShield() {
    const alpha = 0.28 + Math.abs(Math.sin(clock * 2.4)) * 0.18;
    ctx.strokeStyle = `rgba(139,211,255,${alpha + 0.3})`;
    ctx.fillStyle = `rgba(139,211,255,${alpha * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawSlamCharge() {
    ctx.fillStyle = `rgba(255,183,3,${0.3 + Math.abs(Math.sin(clock * 8)) * 0.4})`;
    rect(-34, 44, 68, 6);
  }

  function drawSpeedLines(state) {
    ctx.strokeStyle = state.rocket > 0 ? "rgba(255,138,92,0.55)" : "rgba(77,208,255,0.55)";
    ctx.lineWidth = 3;
    for (let index = 0; index < 5; index += 1) {
      const offset = -40 - index * 16;
      ctx.beginPath();
      ctx.moveTo(offset, -26 + index * 13);
      ctx.lineTo(offset - 26, -26 + index * 13);
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------ 画布文字 */

  function drawOverlayText(state) {
    ctx.textAlign = "center";
    if (state.mode === "countdown") {
      const value = Math.ceil(state.countdown);
      const label = value > 0 ? String(value) : "GO!";
      const progress = 1 - (state.countdown - Math.floor(state.countdown));
      ctx.save();
      ctx.fillStyle = "rgba(23,32,51,0.45)";
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      ctx.translate(CONFIG.width / 2, CONFIG.height / 2);
      ctx.scale(1 + progress * 0.35, 1 + progress * 0.35);
      ctx.font = "900 92px system-ui";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(23,32,51,0.85)";
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.font = "bold 20px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(state.level.name + " · " + state.level.brief, CONFIG.width / 2, CONFIG.height / 2 + 78);
    }

    if (state.toastTimer > 0 && state.toast) {
      const alpha = clamp01(state.toastTimer);
      ctx.font = "900 26px system-ui";
      ctx.lineWidth = 5;
      ctx.strokeStyle = `rgba(23,32,51,${alpha * 0.8})`;
      ctx.strokeText(state.toast, CONFIG.width / 2, 128);
      ctx.fillStyle = rgb(state.toastColor, alpha);
      ctx.fillText(state.toast, CONFIG.width / 2, 128);
    }

    if (state.mode === "capturing") {
      ctx.font = "900 46px system-ui";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(23,32,51,0.8)";
      ctx.strokeText("夺旗成功！", CONFIG.width / 2, 220);
      ctx.fillStyle = "#ffd166";
      ctx.fillText("夺旗成功！", CONFIG.width / 2, 220);
    }

    if (state.mode === "playing" && state.level.boss && state.distance > (state.bossAt || 1e9) - 120 && state.distance < (state.bossAt || -1) && state.phase === "run") {
      ctx.font = "900 22px system-ui";
      ctx.fillStyle = `rgba(255,93,93,${0.5 + Math.abs(Math.sin(clock * 4)) * 0.5})`;
      ctx.fillText("前方探测到机械犬信号…", CONFIG.width / 2, 150);
    }
  }

  ns.renderer = { init, draw };
})(window.DQM);
