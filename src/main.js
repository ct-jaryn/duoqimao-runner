/* 夺旗猫跑酷 · 主控：状态机、主循环、输入绑定、结算与存档 */
(function (ns) {
  const { LEVELS, CHARACTERS, CONFIG, storage, ui, world, renderer, audio, utils } = ns;

  const canvas = document.getElementById("gameCanvas");
  const stage = document.getElementById("stage");

  let state = null;
  let attract = null;
  let lastTime = 0;
  let frameHandle = 0;
  let lastResult = null;
  const pressed = new Set();

  /* ------------------------------------------------------------------ 循环 */

  function tick(time) {
    frameHandle = requestAnimationFrame(tick);
    const dt = Math.min(0.034, Math.max(0, (time - lastTime) / 1000) || 0.016);
    lastTime = time;
    step(dt);
  }

  /* 单帧推进，独立于 rAF，便于在隐藏标签页或自动化环境里验证 */
  function step(dt) {
    const active = state || attract;
    if (!active) return false;

    const playing = active.mode === "playing" || active.mode === "countdown" || active.mode === "capturing";
    if (playing) world.update(active, dt);

    ns.assets.advance(dt, active.effSpeed || active.speed, active.cat.action);
    renderer.draw(active, playing ? dt : dt * 0.4);

    if (state === active) {
      ui.syncHud(active);
      if (active.mode === "won" || active.mode === "lost") settle(active);
    } else if (attract && (attract.mode === "won" || attract.mode === "lost" || attract.distance > attract.level.goal)) {
      attract = makeAttract();
    }
    return true;
  }

  function pump(frames, dt) {
    for (let index = 0; index < (frames || 60); index += 1) step(dt || 1 / 60);
    return {
      state: state ? snapshot(state) : null,
      attract: attract ? snapshot(attract) : null,
    };
  }

  function snapshot(source) {
    return {
      mode: source.mode,
      phase: source.phase,
      level: source.level.id,
      distance: Math.floor(source.distance),
      score: source.score,
      lives: source.lives,
      coins: source.coins,
      gems: source.gems,
      entities: source.platforms.length + source.enemies.length + source.coinList.length + source.pipes.length,
      particles: source.particles.length,
      catY: Math.round(source.cat.y),
      grounded: source.cat.grounded,
    };
  }

  function makeAttract() {
    const level = LEVELS[Math.floor(utils.hash(performance.now() / 1000) * LEVELS.length) % LEVELS.length];
    const preview = world.createRun(level, CHARACTERS[storage.profile.selectedCharacter] || CHARACTERS.xiaohei);
    preview.mode = "playing";
    preview.countdown = 0;
    preview.attract = true;
    return preview;
  }

  /* ------------------------------------------------------------------ 流程 */

  function currentCharacter() {
    return CHARACTERS[storage.profile.selectedCharacter] || CHARACTERS.xiaohei;
  }

  function startLevel(levelId) {
    const level = utils.levelById(levelId);
    audio.unlock();
    state = world.createRun(level, currentCharacter());
    attract = null;
    lastResult = null;
    ui.openScreen(null);
    ui.setHudVisible(true);
    ui.setPauseIcon(false);
    document.getElementById("levelName").textContent = level.name;
    document.getElementById("skillName").textContent = characterSkillName();
    audio.setBgmTrackForTheme(level.theme);
    audio.startBgm();
  }

  function characterSkillName() {
    return currentCharacter().skill.name;
  }

  function resumeAttract() {
    state = null;
    attract = makeAttract();
    ui.setHudVisible(false);
    ui.setPauseIcon(false);
    audio.stopBgm();
  }

  function togglePause() {
    if (!state) return;
    if (state.mode === "playing" || state.mode === "capturing" || state.mode === "countdown") {
      state.pausedFrom = state.mode;
      state.mode = "paused";
      ui.openScreen("pause", { returnTo: "levels" });
      ui.setPauseIcon(true);
      audio.stopBgm();
      return;
    }
    if (state.mode === "paused") resume();
  }

  function resume() {
    if (!state || state.mode !== "paused") return;
    state.mode = state.pausedFrom || "playing";
    ui.openScreen(null);
    ui.setPauseIcon(false);
    if (state.mode === "playing") {
      audio.unlock();
      audio.startBgm();
    }
  }

  function restart() {
    if (!state) return;
    startLevel(state.level.id);
  }

  function quit() {
    state = null;
    audio.stopBgm();
    resumeAttract();
    ui.openScreen("levels");
  }

  function settle(finished) {
    const result = finished.result || { won: finished.mode === "won", score: finished.score, stars: 0, levelId: finished.level.id, distance: Math.floor(finished.distance), coins: finished.coins, gems: finished.gems, bestCombo: finished.bestCombo, lives: 0, stomps: 0, time: finished.time, characterId: finished.character.id, reason: "lives" };
    const saved = storage.recordRun(result.levelId, result);
    const level = utils.levelById(result.levelId);
    const best = storage.profile.bestScores[level.id] || result.score;
    lastResult = {
      won: result.won,
      stars: saved.stars,
      score: result.score,
      levelId: level.id,
      nextLevel: saved.unlockedNext ? saved.nextLevel : null,
    };
    const reasonText = { fall: "缺口太深，下次提前起跳", pipe: "管道要正面跳过", spikeEnemy: "紫刺怪不能踩", enemy: "被巡逻怪撞到了", boss: "机械犬的攻势太猛", bomb: "躲开坠落炸弹", spike: "地面尖刺要跳过去" }[result.reason] || "生命耗尽";
    ui.showResult({
      won: result.won,
      stars: saved.stars,
      score: result.score,
      levelName: level.name,
      goal: level.goal,
      distance: result.distance,
      coins: result.coins,
      gems: result.gems,
      bestCombo: result.bestCombo,
      comboMultiplier: Math.min(CONFIG.comboMax, 1 + Math.floor(result.bestCombo / 4)),
      stomps: result.stomps,
      lives: result.lives,
      maxLives: finished.character.maxLives,
      time: result.time,
      best,
      reasonText,
      note: buildNote(result, saved, reasonText),
      primaryLabel: lastResult.won && lastResult.nextLevel ? `挑战下一关 · ${lastResult.nextLevel.name}` : "再来一局",
    });
    state = null;
    resumeAttract();
    ui.openScreen("result");
  }

  function buildNote(result, saved, reasonText) {
    if (!result.won) return reasonText + "。";
    if (saved.gainedStars > 0 && saved.unlockedNext && saved.nextLevel) return `新解锁 ${saved.gainedStars} 颗星，${saved.nextLevel.name} 已开放！`;
    if (saved.gainedStars > 0) return `又拿到 ${saved.gainedStars} 颗星，累计 ${storage.totalStars()} 颗。`;
    if (saved.newBest) return "刷新了本关最佳分数，星级还差一点。";
    return "分数尚未达到更高星级门槛，试试多攒连击。";
  }

  function resultPrimary() {
    if (lastResult && lastResult.won && lastResult.nextLevel) startLevel(lastResult.nextLevel.id);
    else if (lastResult) startLevel(lastResult.levelId);
    else ui.openScreen("levels");
  }

  /* ------------------------------------------------------------------ 输入 */

  function jump() {
    if (!state) return;
    audio.unlock();
    world.jump(state);
  }

  function skill() {
    if (!state) return;
    audio.unlock();
    world.useSkill(state);
  }

  function applySettings() {
    const settings = storage.profile.settings;
    audio.setEnabled({ bgm: settings.bgm, sfx: settings.sfx });
    ui.refreshStats();
  }

  function toggleSetting(key) {
    storage.setSetting(key, !storage.profile.settings[key]);
    applySettings();
    if (storage.profile.settings[key] && state && state.mode === "playing") {
      audio.unlock();
      audio.startBgm();
    }
    audio.play("toggle");
    if (key === "bgm" && !storage.profile.settings.bgm && state && state.mode === "playing") audio.stopBgm();
  }

  function pickCharacter(characterId) {
    if (!storage.selectCharacter(characterId)) {
      audio.play("deny");
      return;
    }
    audio.play("ui");
    ui.renderCharGrid();
    ui.refreshStats();
    if (document.getElementById("skillName")) document.getElementById("skillName").textContent = characterSkillName();
  }

  function openScreen(name, options = {}) {
    if (!name) {
      ui.openScreen(null);
      return;
    }
    audio.play("ui");
    if (name === "menu") resumeAttract();
    ui.openScreen(name, { returnTo: options.returnTo || "menu" });
  }

  function resetProfile() {
    if (!window.confirm("确定清空进度、星级与最高分吗？")) return;
    storage.reset();
    applySettings();
    ui.refreshStats();
    ui.renderCharGrid();
    attract = makeAttract();
  }

  function bindInput() {
    window.addEventListener("keydown", (event) => {
      const code = event.code;
      if (["Space", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(code)) event.preventDefault();
      if (pressed.has(code)) return;
      pressed.add(code);
      if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
        if (state) jump();
        else if (activeScreenIs("menuScreen")) openScreen("levels");
        else pressEnter();
      } else if (code === "ShiftLeft" || code === "ShiftRight" || code === "KeyX") {
        skill();
      } else if (code === "KeyP") {
        if (state) togglePause();
      } else if (code === "KeyR") {
        if (state) restart();
      } else if (code === "KeyM") {
        toggleSetting("bgm");
      } else if (code === "KeyN") {
        toggleSetting("sfx");
      } else if (code === "Escape") {
        if (state && state.mode !== "paused") togglePause();
        else if (state) quit();
        else if (activeScreenIs("pauseScreen")) quit();
        else openScreen("menu");
      } else if (code === "Enter") {
        pressEnter();
      }
    });

    window.addEventListener("keyup", (event) => pressed.delete(event.code));

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (state && state.mode === "playing") jump();
    });

    document.getElementById("touchJump").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      jump();
    });
    document.getElementById("touchSkill").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      skill();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state && state.mode === "playing") togglePause();
    });
    window.addEventListener("blur", () => {
      if (state && state.mode === "playing") togglePause();
    });

    stage.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  function activeScreenIs(id) {
    const screen = document.getElementById(id);
    return Boolean(screen && screen.classList.contains("is-active"));
  }

  function pressEnter() {
    if (activeScreenIs("resultScreen")) resultPrimary();
    else if (activeScreenIs("pauseScreen")) resume();
    else if (activeScreenIs("menuScreen")) openScreen("levels");
    else if (activeScreenIs("levelScreen")) startLevel(nextPlayableLevel());
    else if (activeScreenIs("helpScreen") || activeScreenIs("charScreen")) openScreen(activeScreenIs("charScreen") ? "levels" : "menu");
  }

  function nextPlayableLevel() {
    const level = LEVELS.find((item) => storage.isLevelUnlocked(item.id) && !storage.profile.cleared[item.id]) || LEVELS[LEVELS.length - 1];
    return level.id;
  }

  /* ------------------------------------------------------------------ 启动 */

  function boot() {
    renderer.init(canvas);
    ui.init({
      startLevel,
      openScreen,
      resume,
      restart,
      quit,
      togglePause,
      skill,
      pickCharacter,
      toggleSetting,
      resetProfile,
      resultPrimary,
    });
    applySettings();
    ui.renderCharGrid();
    attract = makeAttract();
    bindInput();
    lastTime = performance.now();
    frameHandle = requestAnimationFrame(tick);
    ns.assets.loadAll().then(() => {
      ui.refreshStats();
    });
    ns.debug = {
      get state() {
        return state;
      },
      get attract() {
        return attract;
      },
      startLevel,
      step,
      pump,
      snapshot,
      togglePause,
      resume,
      settle,
      jump,
      skill,
      restart,
      quit,
      openScreen,
      world,
      storage,
      LEVELS,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.DQM);
