const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = {
  distance: document.getElementById("distanceText"),
  score: document.getElementById("fishText"),
  lives: document.getElementById("lifeText"),
  coins: document.getElementById("flagText"),
  progress: document.getElementById("progressFill"),
};

const startOverlay = document.getElementById("startOverlay");
const startButton = document.getElementById("startButton");
const jumpButton = document.getElementById("jumpButton");
const soundToggle = document.getElementById("soundToggle");
const characterCards = Array.from(document.querySelectorAll(".character-card"));

const CONFIG = {
  width: 960,
  height: 540,
  groundY: 426,
  finishDistance: 3000,
  startSpeed: 265,
  maxSpeed: 500,
  speedGain: 6.2,
  gravity: 1850,
  invincibleSeconds: 1,
  catX: 145,
  healCoinCount: 10,
};

const CHARACTERS = {
  xiaohei: {
    name: "小黑",
    maxLives: 3,
    jumpVelocity: -760,
    width: 62,
    height: 74,
    material: "mecha",
  },
  dazhuang: {
    name: "大壮",
    maxLives: 4,
    jumpVelocity: -620,
    width: 62,
    height: 74,
    material: "dazhuang",
  },
};

const catImage = new Image();
catImage.src = "assets/fallback/cat-preview.gif";

const coinImage = new Image();
coinImage.src = "assets/coin/preview.gif";

const gifAssets = {
  cat: createGifAsset(),
  coin: createGifAsset(),
};

const runMaterial = {
  frames: [],
  frame: 0,
  timer: 0,
  blend: 0,
  ready: false,
  files: Array.from({ length: 24 }, (_, index) => `assets/hercules-sprite-run/frames/frame_${String(index + 1).padStart(3, "0")}.webp`),
};

const jumpMaterial = {
  frames: [],
  frame: 0,
  timer: 0,
  ready: false,
  files: Array.from({ length: 24 }, (_, index) => `assets/hercules-jump/frames/frame_${String(index + 1).padStart(3, "0")}.webp`),
};

const mechaRunMaterial = {
  frames: [],
  frame: 0,
  timer: 0,
  ready: false,
  files: Array.from({ length: 12 }, (_, index) => `assets/mecha-cat-run/frames/frame_${String(index + 1).padStart(3, "0")}.webp`),
};

const mechaJumpMaterial = {
  frames: [],
  frame: 0,
  timer: 0,
  ready: false,
  files: Array.from({ length: 12 }, (_, index) => `assets/mecha-cat-jump/frames/frame_${String(index + 1).padStart(3, "0")}.webp`),
};

const coinMaterial = {
  frames: [],
  frame: 0,
  timer: 0,
  ready: false,
  files: [
    "assets/coin/slices/front.webp",
    "assets/coin/slices/front_right.webp",
    "assets/coin/slices/right.webp",
    "assets/coin/slices/back_right.webp",
    "assets/coin/slices/back.webp",
    "assets/coin/slices/back_left.webp",
    "assets/coin/slices/left.webp",
    "assets/coin/slices/front_left.webp",
  ],
};

const cat = {
  x: CONFIG.catX,
  y: CONFIG.groundY - 74,
  width: 62,
  height: 74,
  vy: 0,
  grounded: true,
  jumpsLeft: 2,
  action: "run",
  invincibleTime: 0,
};

const catSprite = createSpriteState(4);
const coinSprite = createSpriteState(6);
const catVisual = {
  useSheet: false,
  runCycle: 0,
  squash: 1,
  stretchX: 1,
  stretchY: 1,
  bob: 0,
  sway: 0,
  lean: 0,
  landedFlash: 0,
};

let lastTime = 0;
let activeLoop = 0;
let audioEnabled = true;
let audioContext = null;
let bgmTimer = null;
let bgmStep = 0;
let selectedCharacter = "xiaohei";
let game = createGame();

const BGM_PATTERN = [392, 440, 494, 440, 392, 330, 349, 392, 440, 523, 494, 440, 392, 349, 330, 349];
const BGM_BASS = [196, 196, 220, 220, 165, 165, 174, 174];

function createSpriteState(frameCount) {
  return { frame: 0, frameCount, frameWidth: 0, frameHeight: 0, timer: 0 };
}

function createGifAsset() {
  return { frames: [], frame: 0, timer: 0, ready: false };
}

function createGame() {
  const character = getSelectedCharacter();
  return {
    mode: "ready",
    distance: 0,
    speed: CONFIG.startSpeed,
    score: 0,
    coins: 0,
    coinsSinceHeal: 0,
    lives: character.maxLives,
    nextChunkX: 0,
    nextCoinX: 320,
    nextEnemyDistance: 100,
    nextBirdDistance: 1000,
    platforms: [],
    pipes: [],
    enemies: [],
    coinsList: [],
    particles: [],
    clouds: [
      { x: 80, y: 82, scale: 0.86 },
      { x: 390, y: 58, scale: 1.08 },
      { x: 760, y: 106, scale: 0.74 },
    ],
  };
}

function resetCat() {
  const character = getSelectedCharacter();
  cat.width = character.width;
  cat.height = character.height;
  cat.y = CONFIG.groundY - cat.height;
  cat.vy = 0;
  cat.grounded = true;
  cat.jumpsLeft = 2;
  cat.action = "run";
  cat.invincibleTime = 0;
}

function getSelectedCharacter() {
  return CHARACTERS[selectedCharacter] || CHARACTERS.xiaohei;
}

function startGame() {
  unlockAudio();
  startBgm();
  game = createGame();
  resetCat();
  seedLevel();
  hideOverlay();
  game.mode = "playing";
  lastTime = performance.now();
  activeLoop += 1;
  requestAnimationFrame((time) => loop(time, activeLoop));
}

function seedLevel() {
  game.platforms.push({ x: -80, y: CONFIG.groundY, width: 760, height: 120, type: "ground" });
  game.nextChunkX = 680;
  while (game.nextChunkX < CONFIG.width + 680) spawnTerrainChunk();
  while (game.nextCoinX < CONFIG.width + 620) spawnCoinGroup();
  spawnPipe(620);
}

function loop(time, loopId) {
  if (loopId !== activeLoop || game.mode !== "playing") return;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame((nextTime) => loop(nextTime, loopId));
}

function update(dt) {
  const move = game.speed * dt;
  game.distance += move / 10;
  game.speed = Math.min(CONFIG.maxSpeed, game.speed + CONFIG.speedGain * dt);

  updateCat(dt);
  moveWorld(move, dt);
  ensureWorldAhead();
  updateSprites(dt);
  collectCoins();
  handleEnemyCollisions();
  handlePipeCollisions();
  updateParticles(dt);
  trimWorld();
  syncHud();

  if (cat.y > CONFIG.height + 120) damageCat(true);
  if (game.distance >= CONFIG.finishDistance) finishGame(true);
}

function updateCat(dt) {
  cat.invincibleTime = Math.max(0, cat.invincibleTime - dt);
  const wasGrounded = cat.grounded;
  const previousY = cat.y;
  cat.x += (CONFIG.catX - cat.x) * Math.min(1, dt * 8);
  cat.vy += CONFIG.gravity * dt;
  cat.y += cat.vy * dt;
  cat.grounded = false;

  for (const platform of game.platforms) {
    if (!isLandingOn(cat, platform, previousY)) continue;
    cat.y = platform.y - cat.height;
    cat.vy = 0;
    cat.grounded = true;
    cat.jumpsLeft = 2;
    if (!wasGrounded) catVisual.landedFlash = 1;
    break;
  }

  cat.action = cat.grounded ? "run" : "jump";
}

function moveWorld(move, dt) {
  game.nextChunkX -= move;
  game.nextCoinX -= move;

  for (const platform of game.platforms) platform.x -= move;
  for (const pipe of game.pipes) pipe.x -= move;
  for (const coin of game.coinsList) coin.x -= move;
  for (const particle of game.particles) {
    particle.x -= move;
    particle.y -= 40 * dt;
    particle.life -= dt;
  }

  for (const enemy of game.enemies) {
    enemy.x -= move;
    enemy.x += enemy.vx * dt;
    enemy.phase += dt;
    if (enemy.type === "bird") enemy.y = enemy.baseY + Math.sin(enemy.phase * 4.5) * 18;
  }

  for (const cloud of game.clouds) {
    cloud.x -= move * 0.12;
    if (cloud.x < -140) cloud.x = CONFIG.width + random(80, 220);
  }
}

function ensureWorldAhead() {
  while (game.nextChunkX < CONFIG.width + 720) spawnTerrainChunk();
  while (game.nextCoinX < CONFIG.width + 760) spawnCoinGroup();
  while (game.enemies.length < 90 && game.nextEnemyDistance < game.distance + 180) spawnEnemy();
  while (game.enemies.length < 90 && game.nextBirdDistance < game.distance + 190 && game.distance >= 1000) spawnBird();
}

function spawnTerrainChunk() {
  const difficulty = Math.min(1, game.distance / CONFIG.finishDistance);
  const gap = random(60 + difficulty * 34, 126 + difficulty * 42);
  const width = random(230 - difficulty * 35, 480 - difficulty * 55);
  const lastGround = getRightMostGround();
  const safeGap = lastGround < CONFIG.catX + 240 ? 0 : gap;
  const groundX = game.nextChunkX + safeGap;
  game.platforms.push({ x: groundX, y: CONFIG.groundY, width, height: 120, type: "ground" });

  if (Math.random() > 0.38) {
    game.platforms.push({
      x: groundX + random(70, Math.max(90, width - 210)),
      y: randomChoice([272, 312, 338]),
      width: random(118, 210),
      height: 30,
      type: "platform",
    });
  }

  if (Math.random() > 0.4) spawnPipe(groundX + random(96, Math.max(120, width - 76)));
  game.nextChunkX = groundX + width;
}

function getRightMostGround() {
  return game.platforms.reduce((right, platform) => {
    if (platform.type !== "ground") return right;
    return Math.max(right, platform.x + platform.width);
  }, -Infinity);
}

function spawnPipe(x) {
  const height = randomChoice([66, 82, 98]);
  game.pipes.push({ x, y: CONFIG.groundY - height, width: 58, height, hit: false });
}

function spawnCoinGroup() {
  const lane = randomChoice(["low", "mid", "arc"]);
  const count = lane === "arc" ? 5 : 4;
  const startX = game.nextCoinX + random(80, 170);

  for (let index = 0; index < count; index += 1) {
    const arcOffset = lane === "arc" ? Math.abs(index - 2) * 18 : 0;
    const y = lane === "low" ? CONFIG.groundY - 74 : lane === "mid" ? CONFIG.groundY - 144 : CONFIG.groundY - 172 + arcOffset;
    game.coinsList.push({ x: startX + index * 42, y, width: 28, height: 28, collected: false });
  }

  game.nextCoinX = startX + random(260, 420);
}

function spawnEnemy() {
  const stage = Math.floor(game.nextEnemyDistance / 1000);
  const gapByStage = [52, 42, 33, 27];
  const gap = random(gapByStage[Math.min(stage, 3)], gapByStage[Math.min(stage, 3)] + 13);
  const spawnX = CONFIG.width + 120 + Math.max(0, game.nextEnemyDistance - game.distance) * 10;
  const variant = randomChoice(["grunt", "spike", "shield", "sprinter"]);
  const sizeByVariant = {
    grunt: { width: 42, height: 38 },
    spike: { width: 46, height: 42 },
    shield: { width: 50, height: 44 },
    sprinter: { width: 38, height: 34 },
  }[variant];
  game.enemies.push({
    type: "walker",
    variant,
    x: spawnX,
    y: CONFIG.groundY - sizeByVariant.height,
    width: sizeByVariant.width,
    height: sizeByVariant.height,
    vx: variant === "sprinter" ? randomChoice([-86, -72, -58]) : randomChoice([-54, -40, -28, 28]),
    phase: 0,
    alive: true,
  });
  game.nextEnemyDistance += gap;
}

function spawnBird() {
  const y = randomChoice([196, 232, 268]);
  const spawnX = CONFIG.width + 140 + Math.max(0, game.nextBirdDistance - game.distance) * 10;
  game.enemies.push({
    type: "bird",
    x: spawnX,
    y,
    baseY: y,
    width: 50,
    height: 34,
    vx: randomChoice([-92, -76, -62]),
    phase: 0,
    alive: true,
  });
  game.nextBirdDistance += random(28, 43);
}

function updateSprites(dt) {
  configureSprite(catSprite, catImage, 4);
  configureSprite(coinSprite, coinImage, 6);
  advanceCatSprite(dt);
  advanceRunMaterial(dt);
  advanceMechaRunMaterial(dt);
  advanceJumpMaterial(dt);
  advanceMechaJumpMaterial(dt);
  advanceCoinMaterial(dt);
  advanceSprite(coinSprite, dt, 0.08);
  advanceGifAsset(gifAssets.cat, dt);
  advanceGifAsset(gifAssets.coin, dt);
}

function advanceCoinMaterial(dt) {
  if (!coinMaterial.ready) return;
  coinMaterial.timer += dt;
  const frameDuration = 0.07;
  while (coinMaterial.timer >= frameDuration) {
    coinMaterial.timer -= frameDuration;
    coinMaterial.frame = (coinMaterial.frame + 1) % coinMaterial.frames.length;
  }
}

function advanceRunMaterial(dt) {
  if (!runMaterial.ready) return;
  if (cat.action === "jump") return;
  runMaterial.timer += dt;
  const frameDuration = Math.max(0.032, 0.064 - game.speed / 23000);
  while (runMaterial.timer >= frameDuration) {
    runMaterial.timer -= frameDuration;
    runMaterial.frame = (runMaterial.frame + 1) % runMaterial.frames.length;
  }
  runMaterial.blend = Math.min(1, runMaterial.timer / frameDuration);
}

function advanceMechaRunMaterial(dt) {
  if (!mechaRunMaterial.ready || selectedCharacter !== "xiaohei") return;
  mechaRunMaterial.timer += dt;
  const frameDuration = Math.max(0.052, 0.096 - game.speed / 18000);
  while (mechaRunMaterial.timer >= frameDuration) {
    mechaRunMaterial.timer -= frameDuration;
    mechaRunMaterial.frame = (mechaRunMaterial.frame + 1) % mechaRunMaterial.frames.length;
  }
}

function advanceJumpMaterial(dt) {
  if (!jumpMaterial.ready || selectedCharacter !== "dazhuang" || cat.action !== "jump") return;
  jumpMaterial.timer += dt;
  const frameDuration = 0.045;
  while (jumpMaterial.timer >= frameDuration) {
    jumpMaterial.timer -= frameDuration;
    jumpMaterial.frame = Math.min(jumpMaterial.frame + 1, jumpMaterial.frames.length - 1);
  }
}

function advanceMechaJumpMaterial(dt) {
  if (!mechaJumpMaterial.ready || selectedCharacter !== "xiaohei" || cat.action !== "jump") return;
  mechaJumpMaterial.timer += dt;
  const frameDuration = 0.052;
  while (mechaJumpMaterial.timer >= frameDuration) {
    mechaJumpMaterial.timer -= frameDuration;
    mechaJumpMaterial.frame = Math.min(mechaJumpMaterial.frame + 1, mechaJumpMaterial.frames.length - 1);
  }
}

function advanceGifAsset(asset, dt) {
  if (!asset.ready || asset.frames.length <= 1) return;
  asset.timer += dt * 1000;
  const frame = asset.frames[asset.frame];
  if (asset.timer >= frame.delay) {
    asset.timer = 0;
    asset.frame = (asset.frame + 1) % asset.frames.length;
  }
}

function configureSprite(sprite, image, fallbackFrames) {
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
  const estimatedFrames = Math.round(image.naturalWidth / image.naturalHeight);
  sprite.frameCount = Math.max(1, Math.min(12, estimatedFrames || fallbackFrames));
  sprite.frameWidth = image.naturalWidth / sprite.frameCount;
  sprite.frameHeight = image.naturalHeight;
  if (image === catImage) catVisual.useSheet = image.naturalWidth >= image.naturalHeight * 2.6;
}

function advanceCatSprite(dt) {
  catVisual.runCycle += dt * (cat.grounded ? game.speed / 58 : game.speed / 130);
  catVisual.landedFlash = Math.max(0, catVisual.landedFlash - dt * 7);
  const cycle = catVisual.runCycle * Math.PI * 2;
  const targetBob = 0;
  const targetSway = 0;
  const targetLean = cat.action === "jump" ? Math.max(-0.1, Math.min(0.1, cat.vy / 4200)) : 0;
  const runSquash = 0;
  const landingSquash = catVisual.landedFlash * 0.1;
  const targetScaleX = 1 + landingSquash + Math.max(0, runSquash) * 0.45;
  const targetScaleY = 1 - landingSquash - Math.max(0, runSquash) * 0.38;
  catVisual.bob += (targetBob - catVisual.bob) * Math.min(1, dt * 14);
  catVisual.sway += (targetSway - catVisual.sway) * Math.min(1, dt * 12);
  catVisual.lean += (targetLean - catVisual.lean) * Math.min(1, dt * 12);
  catVisual.stretchX += (targetScaleX - catVisual.stretchX) * Math.min(1, dt * 13);
  catVisual.stretchY += (targetScaleY - catVisual.stretchY) * Math.min(1, dt * 13);
  if (cat.action === "jump") {
    catSprite.frame = Math.min(1, catSprite.frameCount - 1);
    return;
  }
  advanceSprite(catSprite, dt, Math.max(0.065, 0.14 - game.speed / 8000));
}

function advanceSprite(sprite, dt, frameDuration) {
  sprite.timer += dt;
  if (sprite.timer >= frameDuration) {
    sprite.timer = 0;
    sprite.frame = (sprite.frame + 1) % sprite.frameCount;
  }
}

function collectCoins() {
  const box = getCatBox();
  for (const coin of game.coinsList) {
    if (coin.collected || !intersects(box, coin)) continue;
    coin.collected = true;
    game.coins += 1;
    game.coinsSinceHeal += 1;
    game.score += 10;
    spawnCoinBurst(coin.x + 14, coin.y + 14);
    popHud(hud.score);
    popHud(hud.coins);
    playSound("coin");

    if (game.coinsSinceHeal >= CONFIG.healCoinCount) {
      game.coinsSinceHeal = 0;
      const character = getSelectedCharacter();
      if (game.lives < character.maxLives) {
        game.lives += 1;
        game.particles.push({ type: "text", x: cat.x + 30, y: cat.y - 18, text: "回血 +1❤️", life: 1.1, color: [239, 71, 111] });
        popHud(hud.lives);
      } else {
        game.particles.push({ type: "text", x: cat.x + 30, y: cat.y - 18, text: "生命已满", life: 0.85, color: [239, 71, 111] });
      }
      playSound("heal");
    }
  }
}

function spawnCoinBurst(x, y) {
  game.particles.push({ type: "text", x, y: y - 10, text: "+10", life: 0.72 });
  game.particles.push({ type: "ring", x, y, radius: 8, life: 0.38 });
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    game.particles.push({
      type: "spark",
      x,
      y,
      vx: Math.cos(angle) * random(36, 72),
      vy: Math.sin(angle) * random(28, 62),
      life: random(0.28, 0.48),
      size: random(3, 6),
    });
  }
}

function handleEnemyCollisions() {
  const box = getCatBox();
  for (const enemy of game.enemies) {
    if (!enemy.alive || !intersects(box, enemy)) continue;
    const stompWindow = enemy.type === "bird" ? 20 : 28;
    const stomping = cat.vy > 110 && box.y + box.height - enemy.y < stompWindow;
    if (stomping) {
      enemy.alive = false;
      cat.vy = getSelectedCharacter().jumpVelocity * 0.62;
      cat.grounded = false;
      cat.action = "jump";
      resetJumpMaterial();
      cat.jumpsLeft = Math.max(cat.jumpsLeft, 1);
      game.score += 30;
      game.particles.push({ x: enemy.x + 20, y: enemy.y - 8, text: "+30", life: 0.75 });
      playSound("stomp");
    } else {
      damageCat();
    }
    return;
  }
}

function handlePipeCollisions() {
  const box = getCatBox();
  for (const pipe of game.pipes) {
    if (!intersects(box, pipe)) continue;
    const catBottom = box.y + box.height;
    const pipeTop = pipe.y;
    const landing = cat.vy >= 0 && catBottom - pipeTop < 22;
    if (landing) {
      cat.y = pipe.y - cat.height;
      cat.vy = 0;
      cat.grounded = true;
      cat.jumpsLeft = 2;
      cat.action = "run";
      return;
    }
    if (box.x < pipe.x + pipe.width / 2) {
      const targetRight = pipe.x - 2;
      cat.x = Math.min(cat.x, targetRight - (box.width + 10));
      cat.vy = Math.min(cat.vy, 0);
    } else {
      const targetLeft = pipe.x + pipe.width + 2;
      cat.x = Math.max(cat.x, targetLeft - 10);
    }
    return;
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    if (particle.type === "spark") {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 120 * dt;
    }
    if (particle.type === "ring") particle.radius += 70 * dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function trimWorld() {
  game.platforms = game.platforms.filter((item) => item.x + item.width > -120);
  game.pipes = game.pipes.filter((item) => item.x + item.width > -80);
  game.enemies = game.enemies.filter((item) => item.x + item.width > -80 && item.alive);
  game.coinsList = game.coinsList.filter((item) => item.x + item.width > -80 && !item.collected);
}

function jump() {
  if (game.mode !== "playing" || cat.jumpsLeft <= 0) return;
  cat.vy = getSelectedCharacter().jumpVelocity;
  cat.grounded = false;
  cat.jumpsLeft -= 1;
  cat.action = "jump";
  resetJumpMaterial();
  playSound(cat.jumpsLeft === 1 ? "jump" : "doubleJump");
}

function damageCat(fell = false) {
  if (cat.invincibleTime > 0 || game.mode !== "playing") return;
  game.lives -= 1;
  cat.invincibleTime = CONFIG.invincibleSeconds;
  cat.vy = getSelectedCharacter().jumpVelocity * 0.45;
  cat.grounded = false;
  cat.action = "jump";
  resetJumpMaterial();
  if (fell) {
    cat.y = CONFIG.groundY - cat.height;
    cat.vy = 0;
    cat.grounded = true;
    cat.jumpsLeft = 2;
    cat.action = "run";
  }
  playSound("hurt");

  if (game.lives <= 0) finishGame(false);
}

function finishGame(won) {
  if (game.mode !== "playing") return;
  game.mode = won ? "won" : "lost";
  activeLoop += 1;
  stopBgm();
  playSound(won ? "win" : "lose");
  showOverlay(
    won ? "闯关成功" : "挑战失败",
    won ? `得分 ${game.score}，吃到 ${game.coins} 枚金币。` : `本局得分 ${game.score}，注意管道和怪物节奏。`,
    "再来一局",
  );
}

function togglePause() {
  if (game.mode === "playing") {
    game.mode = "paused";
    activeLoop += 1;
    stopBgm();
    showOverlay("暂停中", "按 P 或点击按钮继续奔跑", "继续");
    return;
  }

  if (game.mode === "paused") {
    game.mode = "playing";
    hideOverlay();
    startBgm();
    lastTime = performance.now();
    activeLoop += 1;
    requestAnimationFrame((time) => loop(time, activeLoop));
  }
}

function isLandingOn(actor, platform, previousY) {
  const previousBottom = previousY + actor.height;
  const currentBottom = actor.y + actor.height;
  const horizontal = actor.x + actor.width > platform.x + 8 && actor.x < platform.x + platform.width - 8;
  return actor.vy >= 0 && horizontal && previousBottom <= platform.y + 14 && currentBottom >= platform.y;
}

function getCatBox() {
  return { x: cat.x + 10, y: cat.y + 8, width: cat.width - 4, height: cat.height - 12 };
}

function syncHud() {
  hud.distance.textContent = `${Math.floor(game.distance)}m`;
  hud.score.textContent = String(game.score);
  hud.lives.textContent = "❤️".repeat(Math.max(0, game.lives)) || "0";
  hud.coins.textContent = `${Math.max(0, Math.ceil(CONFIG.finishDistance - game.distance))}m`;
  hud.progress.style.width = `${Math.min(100, (game.distance / CONFIG.finishDistance) * 100)}%`;
}

function showOverlay(title, copy, buttonText) {
  startOverlay.querySelector("h2").textContent = title;
  startOverlay.querySelector(".overlay-copy").textContent = copy;
  startButton.textContent = buttonText;
  startOverlay.classList.add("is-visible");
}

function hideOverlay() {
  startOverlay.classList.remove("is-visible");
}

function draw() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  drawSky();
  drawMountains();
  drawPlatforms();
  drawPipes();
  drawCoins();
  drawEnemies();
  drawParticles();
  drawCat();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
  gradient.addColorStop(0, "#77d5ff");
  gradient.addColorStop(0.72, "#c9f3ff");
  gradient.addColorStop(1, "#fff0b8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = "rgba(255, 239, 174, 0.78)";
  ctx.beginPath();
  ctx.arc(820, 84, 34, 0, Math.PI * 2);
  ctx.fill();
  for (const cloud of game.clouds) drawCloud(cloud.x, cloud.y, cloud.scale);
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  pixelRect(x, y, 42 * scale, 18 * scale);
  pixelRect(x + 18 * scale, y - 16 * scale, 52 * scale, 34 * scale);
  pixelRect(x + 60 * scale, y - 2 * scale, 42 * scale, 20 * scale);
}

function drawMountains() {
  const farOffset = -(game.distance * 2.4) % 360;
  ctx.fillStyle = "rgba(92, 161, 189, 0.22)";
  for (let index = -1; index < 5; index += 1) {
    const x = farOffset + index * 360;
    ctx.beginPath();
    ctx.moveTo(x, CONFIG.groundY);
    ctx.lineTo(x + 178, 214);
    ctx.lineTo(x + 360, CONFIG.groundY);
    ctx.closePath();
    ctx.fill();
  }

  const offset = -(game.distance * 5) % 300;
  ctx.fillStyle = "rgba(47, 191, 113, 0.28)";
  for (let index = -1; index < 6; index += 1) {
    const x = offset + index * 300;
    ctx.beginPath();
    ctx.moveTo(x, CONFIG.groundY);
    ctx.lineTo(x + 145, 240);
    ctx.lineTo(x + 300, CONFIG.groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlatforms() {
  for (const platform of game.platforms) {
    if (platform.type === "platform") {
      ctx.fillStyle = "#e0a04a";
      pixelRect(platform.x, platform.y, platform.width, platform.height);
      ctx.fillStyle = "#ffd166";
      pixelRect(platform.x, platform.y, platform.width, 6);
      ctx.fillStyle = "#8f5a2a";
      pixelRect(platform.x, platform.y + platform.height - 8, platform.width, 8);
      ctx.fillStyle = "rgba(83, 51, 24, 0.28)";
      for (let x = platform.x + 12; x < platform.x + platform.width; x += 34) pixelRect(x, platform.y + 11, 14, 6);
      continue;
    }
    ctx.fillStyle = "#6bd85f";
    pixelRect(platform.x, platform.y - 8, platform.width, 10);
    ctx.fillStyle = "#45bd5f";
    pixelRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = "#7ce06b";
    for (let x = platform.x + 6; x < platform.x + platform.width; x += 24) pixelRect(x, platform.y - 14, 12, 8);
    ctx.fillStyle = "#2d9c4d";
    pixelRect(platform.x, platform.y + 22, platform.width, 12);
    ctx.fillStyle = "#8b5a2b";
    pixelRect(platform.x, platform.y + 38, platform.width, platform.height - 38);
    ctx.fillStyle = "#6f4524";
    for (let x = platform.x; x < platform.x + platform.width; x += 48) {
      pixelRect(x + 8, platform.y + 54, 20, 10);
      pixelRect(x + 28, platform.y + 82, 16, 8);
    }
    ctx.fillStyle = "rgba(255, 240, 188, 0.22)";
    for (let x = platform.x + 18; x < platform.x + platform.width; x += 86) pixelRect(x, platform.y + 52, 10, 10);
  }
}

function drawPipes() {
  for (const pipe of game.pipes) {
    ctx.fillStyle = "#179c57";
    pixelRect(pipe.x, pipe.y, pipe.width, pipe.height);
    ctx.fillStyle = "#2fc878";
    pixelRect(pipe.x - 8, pipe.y, pipe.width + 16, 18);
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    pixelRect(pipe.x + 10, pipe.y + 24, 10, pipe.height - 30);
  }
}

function drawCoins() {
  for (const coin of game.coinsList) drawCoin(coin);
}

function drawCoin(coin) {
  const bob = Math.sin(performance.now() / 180 + coin.x * 0.01) * 4;
  const squash = Math.max(0.28, Math.abs(Math.cos(performance.now() / 160 + coin.x * 0.01)));
  ctx.save();
  ctx.translate(coin.x + coin.width / 2, coin.y + coin.height / 2 + bob);
  ctx.scale(squash, 1);
  const glow = 0.45 + Math.abs(Math.sin(performance.now() / 180 + coin.x * 0.02)) * 0.35;
  ctx.fillStyle = `rgba(255, 209, 102, ${glow})`;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 247, 181, ${0.42 + glow * 0.35})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 29, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  pixelRect(-22, -23, 6, 6);
  pixelRect(20, -15, 4, 4);
  if (coinMaterial.ready) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(coinMaterial.frames[coinMaterial.frame], -22, -22, 44, 44);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
  }
  if (coinImage.complete && coinImage.naturalWidth > 0) {
    if (gifAssets.coin.ready) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gifAssets.coin.frames[gifAssets.coin.frame].canvas, -18, -18, 36, 36);
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
      return;
    }
    const sw = coinSprite.frameWidth || coinImage.naturalWidth / coinSprite.frameCount;
    const sh = coinSprite.frameHeight || coinImage.naturalHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(coinImage, coinSprite.frame * sw, 0, sw, sh, -18, -18, 36, 36);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#ffcc22";
    pixelRect(-12, -14, 24, 28);
  }
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const bob = Math.sin(enemy.phase * 8) * 2;
    if (enemy.type === "bird") {
      drawBirdEnemy(enemy, bob);
      continue;
    }
    drawGroundEnemy(enemy, bob);
  }
}

function drawGroundEnemy(enemy, bob) {
  const y = enemy.y + bob;
  if (enemy.variant === "spike") {
    drawSpikeEnemy(enemy, y);
    return;
  }
  if (enemy.variant === "shield") {
    drawShieldEnemy(enemy, y);
    return;
  }
  if (enemy.variant === "sprinter") {
    drawSprinterEnemy(enemy, y);
    return;
  }
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x - 3, y + 4, enemy.width + 6, enemy.height - 2);
  ctx.fillStyle = "#7a3b2f";
  pixelRect(enemy.x, y, enemy.width, enemy.height);
  ctx.fillStyle = "#a94a38";
  pixelRect(enemy.x + 5, y + 5, enemy.width - 10, 12);
  ctx.fillStyle = "#fff1d0";
  pixelRect(enemy.x + 8, y + 10, 9, 9);
  pixelRect(enemy.x + 25, y + 10, 9, 9);
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 11, y + 13, 4, 4);
  pixelRect(enemy.x + 28, y + 13, 4, 4);
  ctx.fillStyle = "#4b241e";
  pixelRect(enemy.x + 8, y + enemy.height - 5, 10, 7);
  pixelRect(enemy.x + 25, y + enemy.height - 5, 10, 7);
}

function drawSpikeEnemy(enemy, y) {
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x - 3, y + 7, enemy.width + 6, enemy.height - 5);
  ctx.fillStyle = "#5b2b6f";
  pixelRect(enemy.x, y + 8, enemy.width, enemy.height - 8);
  ctx.fillStyle = "#d7c4ff";
  for (let x = enemy.x + 5; x < enemy.x + enemy.width - 4; x += 12) {
    pixelRect(x, y, 8, 9);
  }
  ctx.fillStyle = "#fff1d0";
  pixelRect(enemy.x + 9, y + 18, 8, 8);
  pixelRect(enemy.x + 29, y + 18, 8, 8);
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 12, y + 21, 3, 3);
  pixelRect(enemy.x + 32, y + 21, 3, 3);
}

function drawShieldEnemy(enemy, y) {
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x - 3, y + 3, enemy.width + 6, enemy.height);
  ctx.fillStyle = "#31566f";
  pixelRect(enemy.x, y + 4, enemy.width, enemy.height - 4);
  ctx.fillStyle = "#8bd3ff";
  pixelRect(enemy.x + 7, y + 8, enemy.width - 14, enemy.height - 15);
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 15, y + 16, 6, 6);
  pixelRect(enemy.x + 30, y + 16, 6, 6);
  ctx.fillStyle = "#18364a";
  pixelRect(enemy.x + 9, y + enemy.height - 7, 12, 7);
  pixelRect(enemy.x + 30, y + enemy.height - 7, 12, 7);
}

function drawSprinterEnemy(enemy, y) {
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x - 4, y + 6, enemy.width + 8, enemy.height - 3);
  ctx.fillStyle = "#d94f35";
  pixelRect(enemy.x, y + 4, enemy.width, enemy.height - 4);
  ctx.fillStyle = "#ffb86b";
  pixelRect(enemy.x + 5, y + 8, enemy.width - 10, 8);
  ctx.fillStyle = "#fff1d0";
  pixelRect(enemy.x + 7, y + 15, 7, 7);
  pixelRect(enemy.x + 23, y + 15, 7, 7);
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 10, y + 18, 3, 3);
  pixelRect(enemy.x + 26, y + 18, 3, 3);
  ctx.fillStyle = "#7c2418";
  pixelRect(enemy.x + 2, y + enemy.height - 4, 13, 6);
  pixelRect(enemy.x + 23, y + enemy.height - 4, 13, 6);
}

function drawBirdEnemy(enemy, bob) {
  const wing = Math.sin(enemy.phase * 12) > 0 ? -8 : 4;
  const y = enemy.y + bob;
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 7, y + 11, 36, 20);
  ctx.fillStyle = "#2b3856";
  pixelRect(enemy.x + 9, y + 10, 32, 18);
  ctx.fillStyle = "#4f68a8";
  pixelRect(enemy.x - 3, y + 8 + wing, 22, 9);
  pixelRect(enemy.x + 31, y + 8 + wing, 22, 9);
  ctx.fillStyle = "#86a8ff";
  pixelRect(enemy.x + 14, y + 14, 10, 6);
  ctx.fillStyle = "#ffe8a3";
  pixelRect(enemy.x + 39, y + 15, 11, 6);
  ctx.fillStyle = "#fff1d0";
  pixelRect(enemy.x + 28, y + 13, 6, 6);
  ctx.fillStyle = "#172033";
  pixelRect(enemy.x + 30, y + 15, 3, 3);
}

function drawParticles() {
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  for (const particle of game.particles) {
    const alpha = Math.min(1, particle.life * 2.6);
    if (particle.type === "spark") {
      ctx.fillStyle = `rgba(255, 183, 3, ${alpha})`;
      pixelRect(particle.x, particle.y, particle.size, particle.size);
      continue;
    }
    if (particle.type === "ring") {
      ctx.strokeStyle = `rgba(255, 183, 3, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = particle.color ? `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha})` : `rgba(244, 124, 72, ${alpha})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.strokeText(particle.text, particle.x, particle.y);
    ctx.fillText(particle.text, particle.x, particle.y);
  }
}

function popHud(element) {
  element.classList.remove("is-popping");
  void element.offsetWidth;
  element.classList.add("is-popping");
}

function drawCat() {
  const blink = cat.invincibleTime > 0 && Math.floor(cat.invincibleTime * 18) % 2 === 0;
  if (blink) return;
  const character = getSelectedCharacter();
  drawCatShadow();
  ctx.save();
  ctx.translate(Math.round(cat.x + cat.width / 2 + catVisual.sway), Math.round(cat.y + cat.height / 2 + catVisual.bob));
  ctx.rotate(catVisual.lean);
  ctx.scale(catVisual.stretchX, catVisual.stretchY);
  if (character.material === "dazhuang" && cat.action === "jump" && jumpMaterial.ready) {
    const frame = jumpMaterial.frames[jumpMaterial.frame];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -47, -50, 94, 100);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
  }
  if (character.material === "mecha" && cat.action === "jump" && mechaJumpMaterial.ready) {
    const frame = mechaJumpMaterial.frames[mechaJumpMaterial.frame];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -47, -50, 94, 100);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
  }
  if (character.material === "dazhuang" && runMaterial.ready) {
    const frame = runMaterial.frames[runMaterial.frame];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -47, -50, 94, 100);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
  }
  if (character.material === "mecha" && mechaRunMaterial.ready) {
    const frame = mechaRunMaterial.frames[mechaRunMaterial.frame];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -47, -50, 94, 100);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return;
  }
  if (catImage.complete && catImage.naturalWidth > 0) {
    if (gifAssets.cat.ready) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gifAssets.cat.frames[gifAssets.cat.frame].canvas, -42, -45, 84, 90);
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
      return;
    }
    const sw = catVisual.useSheet ? catSprite.frameWidth || catImage.naturalWidth / catSprite.frameCount : catImage.naturalWidth;
    const sh = catVisual.useSheet ? catSprite.frameHeight || catImage.naturalHeight : catImage.naturalHeight;
    const sx = catVisual.useSheet ? catSprite.frame * sw : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(catImage, sx, 0, sw, sh, -42, -45, 84, 90);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#172033";
    pixelRect(-26, -22, 52, 44);
    ctx.fillStyle = "#4ade80";
    pixelRect(10, -24, 8, 8);
  }
  ctx.restore();
}

function drawCatShadow() {
  const heightFromGround = Math.max(0, CONFIG.groundY - (cat.y + cat.height));
  const width = Math.max(24, 54 - heightFromGround * 0.16);
  const alpha = Math.max(0.08, 0.26 - heightFromGround * 0.002);
  ctx.fillStyle = `rgba(23, 32, 51, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cat.x + cat.width / 2, CONFIG.groundY + 4, width, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function pixelRect(x, y, width, height) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function playTone(frequency, duration, options = {}) {
  if (!audioEnabled) return;
  if (!unlockAudio()) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime + (options.delay || 0);
  const volume = options.volume || 0.045;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, now + duration);
  oscillator.type = options.type || "sine";
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playSound(name) {
  const sounds = {
    coin: [
      [880, 0.08, { type: "sine", to: 1320, volume: 0.04 }],
      [1320, 0.07, { type: "triangle", delay: 0.045, volume: 0.024 }],
    ],
    heal: [
      [523, 0.11, { type: "sine", volume: 0.035 }],
      [659, 0.12, { type: "sine", delay: 0.08, volume: 0.034 }],
      [784, 0.16, { type: "triangle", delay: 0.16, volume: 0.032 }],
    ],
    stomp: [[360, 0.12, { type: "triangle", to: 540, volume: 0.04 }]],
    jump: [[360, 0.12, { type: "triangle", to: 560, volume: 0.038 }]],
    doubleJump: [[420, 0.13, { type: "triangle", to: 720, volume: 0.04 }]],
    hurt: [
      [220, 0.18, { type: "sine", to: 120, volume: 0.048 }],
      [146, 0.14, { type: "triangle", delay: 0.05, volume: 0.026 }],
    ],
    win: [
      [523, 0.12, { type: "sine", volume: 0.04 }],
      [659, 0.12, { type: "sine", delay: 0.1, volume: 0.038 }],
      [784, 0.2, { type: "triangle", delay: 0.2, volume: 0.038 }],
    ],
    lose: [
      [294, 0.16, { type: "sine", volume: 0.04 }],
      [220, 0.22, { type: "triangle", delay: 0.13, volume: 0.034 }],
    ],
    toggle: [[660, 0.09, { type: "sine", to: 880, volume: 0.028 }]],
  };
  for (const [frequency, duration, options] of sounds[name] || []) playTone(frequency, duration, options);
}

function playBgmNote(frequency, duration, type, volume) {
  if (!audioEnabled || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function tickBgm() {
  if (!audioEnabled || game.mode !== "playing") return;
  const melody = BGM_PATTERN[bgmStep % BGM_PATTERN.length];
  const bass = BGM_BASS[Math.floor(bgmStep / 2) % BGM_BASS.length];
  playBgmNote(melody, 0.26, "triangle", 0.014);
  if (bgmStep % 2 === 0) playBgmNote(bass, 0.48, "sine", 0.012);
  bgmStep += 1;
}

function startBgm() {
  if (!audioEnabled || bgmTimer || !unlockAudio()) return;
  tickBgm();
  bgmTimer = window.setInterval(tickBgm, 320);
}

function stopBgm() {
  if (!bgmTimer) return;
  window.clearInterval(bgmTimer);
  bgmTimer = null;
}

function unlockAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return false;
  audioContext ||= new AudioContextCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  return true;
}

function selectCharacter(characterId) {
  if (!CHARACTERS[characterId]) return;
  selectedCharacter = characterId;
  characterCards.forEach((card) => {
    const selected = card.dataset.character === selectedCharacter;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  if (game.mode === "ready" || game.mode === "lost" || game.mode === "won") {
    game.lives = getSelectedCharacter().maxLives;
    resetCat();
    syncHud();
    draw();
  }
}

startButton.addEventListener("click", () => {
  if (game.mode === "paused") togglePause();
  else startGame();
});

for (const card of characterCards) {
  card.addEventListener("click", () => selectCharacter(card.dataset.character));
}

jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  unlockAudio();
  jump();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  unlockAudio();
  jump();
});

soundToggle.addEventListener("click", () => {
  unlockAudio();
  audioEnabled = !audioEnabled;
  soundToggle.setAttribute("aria-pressed", String(audioEnabled));
  soundToggle.textContent = audioEnabled ? "音效：开" : "音效：关";
  if (audioEnabled && game.mode === "playing") startBgm();
  if (!audioEnabled) stopBgm();
  playSound("toggle");
});

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp"].includes(event.code)) event.preventDefault();
  if (event.code === "Space" || event.code === "ArrowUp") jump();
  if (event.code === "KeyP") togglePause();
  if (event.code === "Enter" && game.mode !== "playing") startButton.click();
});

catImage.addEventListener("load", draw);
coinImage.addEventListener("load", draw);
loadRunMaterial();
loadJumpMaterial();
loadMechaRunMaterial();
loadMechaJumpMaterial();
loadCoinMaterial();
loadGifMaterial(catImage.src, gifAssets.cat);
loadGifMaterial(coinImage.src, gifAssets.coin);
syncHud();
draw();

async function loadRunMaterial() {
  const frames = await Promise.all(runMaterial.files.map(loadImage));
  runMaterial.frames = frames.filter(Boolean);
  runMaterial.ready = runMaterial.frames.length > 0;
  runMaterial.frame = 0;
  runMaterial.timer = 0;
  runMaterial.blend = 0;
  draw();
}

async function loadJumpMaterial() {
  const frames = await Promise.all(jumpMaterial.files.map(loadImage));
  jumpMaterial.frames = frames.filter(Boolean);
  jumpMaterial.ready = jumpMaterial.frames.length > 0;
  jumpMaterial.frame = 0;
  jumpMaterial.timer = 0;
  draw();
}

async function loadMechaRunMaterial() {
  const frames = await Promise.all(mechaRunMaterial.files.map(loadImage));
  mechaRunMaterial.frames = frames.filter(Boolean);
  mechaRunMaterial.ready = mechaRunMaterial.frames.length > 0;
  mechaRunMaterial.frame = 0;
  mechaRunMaterial.timer = 0;
  draw();
}

async function loadMechaJumpMaterial() {
  const frames = await Promise.all(mechaJumpMaterial.files.map(loadImage));
  mechaJumpMaterial.frames = frames.filter(Boolean);
  mechaJumpMaterial.ready = mechaJumpMaterial.frames.length > 0;
  mechaJumpMaterial.frame = 0;
  mechaJumpMaterial.timer = 0;
  draw();
}

function resetJumpMaterial() {
  jumpMaterial.frame = 0;
  jumpMaterial.timer = 0;
  mechaJumpMaterial.frame = 0;
  mechaJumpMaterial.timer = 0;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadCoinMaterial() {
  const frames = await Promise.all(coinMaterial.files.map(loadImage));
  coinMaterial.frames = frames.filter(Boolean);
  coinMaterial.ready = coinMaterial.frames.length > 0;
  coinMaterial.frame = 0;
  coinMaterial.timer = 0;
  draw();
}

async function loadGifMaterial(url, asset) {
  try {
    const buffer = await fetch(url).then((response) => response.arrayBuffer());
    const frames = decodeGif(buffer);
    asset.frames = frames.map((frame) => {
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = frame.width;
      frameCanvas.height = frame.height;
      frameCanvas.getContext("2d").putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
      return { canvas: frameCanvas, delay: Math.max(40, frame.delay) };
    });
    asset.ready = asset.frames.length > 0;
    draw();
  } catch (error) {
    console.warn("GIF material decode failed", error);
  }
}

function decodeGif(buffer) {
  const data = new Uint8Array(buffer);
  let offset = 0;
  const readByte = () => data[offset++];
  const readWord = () => readByte() | (readByte() << 8);
  const readBytes = (count) => data.slice(offset, offset += count);
  const signature = String.fromCharCode(...readBytes(6));
  if (!signature.startsWith("GIF")) return [];

  const width = readWord();
  const height = readWord();
  const packed = readByte();
  readByte();
  readByte();
  const globalColorTable = packed & 0x80 ? readColorTable(1 << ((packed & 0x07) + 1)) : null;
  const canvasPixels = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let gce = { delay: 100, transparentIndex: -1, disposal: 0 };

  while (offset < data.length) {
    const blockId = readByte();
    if (blockId === 0x3b) break;
    if (blockId === 0x21) {
      const label = readByte();
      if (label === 0xf9) {
        readByte();
        const flags = readByte();
        const delay = readWord() * 10;
        const transparentIndex = readByte();
        readByte();
        gce = { delay: delay || 100, transparentIndex: flags & 1 ? transparentIndex : -1, disposal: (flags >> 2) & 7 };
      } else {
        skipSubBlocks();
      }
      continue;
    }
    if (blockId !== 0x2c) break;

    const left = readWord();
    const top = readWord();
    const frameWidth = readWord();
    const frameHeight = readWord();
    const imagePacked = readByte();
    const localColorTable = imagePacked & 0x80 ? readColorTable(1 << ((imagePacked & 0x07) + 1)) : null;
    const interlaced = Boolean(imagePacked & 0x40);
    const minCodeSize = readByte();
    const compressed = readSubBlocks();
    const indexes = lzwDecode(minCodeSize, compressed, frameWidth * frameHeight);
    const orderedIndexes = interlaced ? deinterlace(indexes, frameWidth) : indexes;
    const table = localColorTable || globalColorTable;
    const previousPixels = new Uint8ClampedArray(canvasPixels);

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const colorIndex = orderedIndexes[y * frameWidth + x];
        if (colorIndex === gce.transparentIndex) continue;
        const color = table[colorIndex] || [0, 0, 0];
        const target = ((top + y) * width + left + x) * 4;
        canvasPixels[target] = color[0];
        canvasPixels[target + 1] = color[1];
        canvasPixels[target + 2] = color[2];
        canvasPixels[target + 3] = 255;
      }
    }

    frames.push({ width, height, pixels: new Uint8ClampedArray(canvasPixels), delay: gce.delay });
    if (gce.disposal === 2) clearFrame(canvasPixels, left, top, frameWidth, frameHeight, width);
    if (gce.disposal === 3) canvasPixels.set(previousPixels);
  }

  return frames;

  function readColorTable(size) {
    const table = [];
    for (let index = 0; index < size; index += 1) table.push([readByte(), readByte(), readByte()]);
    return table;
  }

  function readSubBlocks() {
    const chunks = [];
    let total = 0;
    while (true) {
      const size = readByte();
      if (size === 0) break;
      const chunk = readBytes(size);
      chunks.push(chunk);
      total += size;
    }
    const bytes = new Uint8Array(total);
    let write = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, write);
      write += chunk.length;
    }
    return bytes;
  }

  function skipSubBlocks() {
    while (true) {
      const size = readByte();
      if (size === 0) break;
      offset += size;
    }
  }
}

function lzwDecode(minCodeSize, bytes, expectedLength) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict = [];
  let bit = 0;
  let previous = null;
  const output = [];

  const reset = () => {
    dict = [];
    for (let index = 0; index < clearCode; index += 1) dict[index] = [index];
    dict[clearCode] = [];
    dict[endCode] = null;
    codeSize = minCodeSize + 1;
    previous = null;
  };

  const readCode = () => {
    let code = 0;
    for (let index = 0; index < codeSize; index += 1) {
      const byte = bytes[bit >> 3];
      code |= ((byte >> (bit & 7)) & 1) << index;
      bit += 1;
    }
    return code;
  };

  reset();
  while (bit < bytes.length * 8 && output.length < expectedLength) {
    const code = readCode();
    if (code === clearCode) {
      reset();
      continue;
    }
    if (code === endCode) break;
    let entry = dict[code];
    if (!entry && previous) entry = previous.concat(previous[0]);
    if (!entry) break;
    output.push(...entry);
    if (previous) {
      dict.push(previous.concat(entry[0]));
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    previous = entry;
  }
  return output.slice(0, expectedLength);
}

function deinterlace(indexes, width) {
  const rows = indexes.length / width;
  const result = new Array(indexes.length);
  let sourceRow = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let row = start; row < rows; row += step) {
      result.splice(row * width, width, ...indexes.slice(sourceRow * width, sourceRow * width + width));
      sourceRow += 1;
    }
  }
  return result;
}

function clearFrame(pixels, left, top, frameWidth, frameHeight, canvasWidth) {
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const target = ((top + y) * canvasWidth + left + x) * 4;
      pixels[target] = 0;
      pixels[target + 1] = 0;
      pixels[target + 2] = 0;
      pixels[target + 3] = 0;
    }
  }
}
