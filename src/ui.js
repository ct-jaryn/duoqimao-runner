/* 夺旗猫跑酷 · 界面层：DOM 屏、HUD 同步、选关与角色卡片 */
(function (ns) {
  const { LEVELS, CHARACTERS, POWERUPS, storage } = ns;
  let dom = {};
  let handlers = {};
  let cache = {};
  let activeScreen = "menu";

  function init(nextHandlers) {
    handlers = nextHandlers;
    const byId = (id) => document.getElementById(id);
    dom = {
      hud: byId("hud"),
      hearts: byId("hearts"),
      buffs: byId("buffList"),
      levelName: byId("levelName"),
      distanceLabel: byId("distanceLabel"),
      progressFill: byId("progressFill"),
      scoreValue: byId("scoreValue"),
      comboValue: byId("comboValue"),
      comboFill: byId("comboFill"),
      comboLine: byId("comboLine"),
      coinValue: byId("coinValue"),
      gemValue: byId("gemValue"),
      skillButton: byId("skillButton"),
      skillFill: byId("skillFill"),
      skillName: byId("skillName"),
      statStars: byId("statStars"),
      statLevels: byId("statLevels"),
      statRuns: byId("statRuns"),
      statBestCat: byId("statBestCat"),
      levelGrid: byId("levelGrid"),
      charGrid: byId("charGrid"),
      powerLegend: byId("powerLegend"),
      resultTitle: byId("resultTitle"),
      resultKicker: byId("resultKicker"),
      resultStars: byId("resultStars"),
      resultScore: byId("resultScore"),
      resultRows: byId("resultRows"),
      resultNote: byId("resultNote"),
      resultPrimary: byId("resultPrimary"),
      pauseButton: byId("pauseButton"),
      bgmButton: byId("bgmButton"),
      sfxButton: byId("sfxButton"),
      screens: {
        menu: byId("menuScreen"),
        levels: byId("levelScreen"),
        chars: byId("charScreen"),
        help: byId("helpScreen"),
        pause: byId("pauseScreen"),
        result: byId("resultScreen"),
      },
    };

    bindClick("playButton", () => handlers.openScreen("levels"));
    bindClick("menuChars", () => handlers.openScreen("chars"));
    bindClick("menuHelp", () => handlers.openScreen("help"));
    bindClick("menuReset", () => handlers.resetProfile());
    bindClick("pauseResume", () => handlers.resume());
    bindClick("pauseRestart", () => handlers.restart());
    bindClick("pauseQuit", () => handlers.quit());
    bindClick("resultPrimary", () => handlers.resultPrimary());
    bindClick("resultAgain", () => handlers.restart());
    bindClick("resultLevels", () => handlers.quit());
    bindClick("skillButton", () => handlers.skill());
    bindClick("bgmButton", () => handlers.toggleSetting("bgm"));
    bindClick("sfxButton", () => handlers.toggleSetting("sfx"));
    bindClick("pauseButton", () => handlers.togglePause());

    for (const card of document.querySelectorAll("[data-close]")) {
      card.addEventListener("click", () => handlers.openScreen(activeScreen === "help" ? "menu" : cache.returnTo || "menu"));
    }

    dom.levelGrid.addEventListener("click", (event) => {
      const tile = event.target.closest("[data-level]");
      if (!tile || tile.classList.contains("is-locked")) {
        ns.audio.play("deny");
        return;
      }
      handlers.startLevel(tile.dataset.level);
    });

    dom.charGrid.addEventListener("click", (event) => {
      const tile = event.target.closest("[data-character]");
      if (!tile || tile.classList.contains("is-locked")) {
        ns.audio.play("deny");
        return;
      }
      handlers.pickCharacter(tile.dataset.character);
    });

    renderPowerLegend();
    refreshStats();
  }

  function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener("click", () => handler());
  }

  function openScreen(name, options = {}) {
    activeScreen = name || null;
    if (options.returnTo) cache.returnTo = options.returnTo;
    for (const [key, element] of Object.entries(dom.screens)) {
      if (!element) continue;
      element.classList.toggle("is-active", key === name);
      element.setAttribute("aria-hidden", String(key !== name));
    }
    if (name === "levels") renderLevelGrid();
    if (name === "chars") renderCharGrid();
    refreshStats();
  }

  function setHudVisible(visible) {
    dom.hud.hidden = !visible;
  }

  /* ------------------------------------------------------------------ 卡片 */

  function renderLevelGrid() {
    dom.levelGrid.innerHTML = LEVELS.map((level, index) => {
      const unlocked = storage.isLevelUnlocked(level.id);
      const stars = storage.profile.stars[level.id] || 0;
      const best = storage.profile.bestScores[level.id] || 0;
      return `
        <button class="level-tile ${unlocked ? "" : "is-locked"}" type="button" data-level="${level.id}" ${unlocked ? "" : 'aria-disabled="true"'}>
          <span class="tile-sky" data-theme="${level.theme}"></span>
          <span class="tile-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="tile-body">
            <strong>${level.name}</strong>
            <em>${level.brief}</em>
            <span class="tile-meta">${level.goal}m · ${level.boss ? "BOSS 战" : "冲刺"}</span>
          </span>
          <span class="tile-stars">${starRow(stars)}</span>
          <span class="tile-best">${best ? `最佳 ${best}` : "尚无记录"}</span>
          ${unlocked ? "" : `<span class="tile-lock">🔒 需先通关第 ${index} 关</span>`}
        </button>`;
    }).join("");
  }

  function renderCharGrid() {
    const selected = storage.profile.selectedCharacter;
    dom.charGrid.innerHTML = Object.values(CHARACTERS)
      .map((character) => {
        const unlocked = storage.isCharacterUnlocked(character.id);
        const frame = character.id === "dazhuang" ? "assets/hercules-sprite-run/frames/frame_001.webp" : "assets/mecha-cat-run/frames/frame_001.webp";
        return `
        <button class="char-tile ${selected === character.id ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}"
                type="button" data-character="${character.id}" style="--accent:${character.accent}">
          <img src="${frame}" alt="${character.name}" class="${character.id === "snowball" ? "tint-snow" : ""}">
          <strong>${character.name}<em>${character.title}</em></strong>
          <span class="char-stats">
            <span>生命 ${character.maxLives}</span>
            <span>跳跃 ${character.jumps} 段</span>
            <span>弹力 ${Math.round(Math.abs(character.jumpVelocity) / 10)}</span>
          </span>
          <span class="char-skill"><b>${character.skill.name}</b>${character.skill.desc}（冷却 ${character.skill.cost}s）</span>
          <span class="char-blurb">${character.blurb}</span>
          ${unlocked ? "" : `<span class="char-lock">🔒 ${character.unlock.label || "未解锁"}</span>`}
        </button>`;
      })
      .join("");
  }

  function starRow(count, size) {
    const total = size || 3;
    let out = "";
    for (let index = 0; index < total; index += 1) out += `<span class="star ${index < count ? "is-on" : ""}" aria-hidden="true"></span>`;
    return out;
  }

  function renderPowerLegend() {
    if (!dom.powerLegend) return;
    dom.powerLegend.innerHTML = Object.entries(POWERUPS)
      .map(([key, def]) => `<li><span class="chip" style="--chip:rgb(${def.color.join(",")})">${def.glyph}</span><b>${def.name}</b>${legendText(key)}</li>`)
      .join("");
  }

  function legendText(kind) {
    const map = {
      magnet: "：9 秒吸入周围金币宝石",
      shield: "：抵挡下一次伤害",
      star: "：6.5 秒无敌，撞碎敌人且分数翻倍",
      heart: "：立刻回复 1 点生命",
      rocket: "：3 秒加速冲刺并清空前路",
    };
    return map[kind] || "";
  }

  function refreshStats() {
    const stars = storage.totalStars();
    dom.statStars.textContent = String(stars);
    dom.statLevels.textContent = String(LEVELS.filter((level) => storage.isLevelUnlocked(level.id)).length);
    dom.statRuns.textContent = String(storage.profile.runs);
    dom.statBestCat.textContent = (CHARACTERS[storage.profile.selectedCharacter] || CHARACTERS.xiaohei).name;
    dom.bgmButton.setAttribute("aria-pressed", String(storage.profile.settings.bgm));
    dom.sfxButton.setAttribute("aria-pressed", String(storage.profile.settings.sfx));
    dom.bgmButton.classList.toggle("is-off", !storage.profile.settings.bgm);
    dom.sfxButton.classList.toggle("is-off", !storage.profile.settings.sfx);
    const character = CHARACTERS[storage.profile.selectedCharacter];
    if (character && dom.skillName) dom.skillName.textContent = character.skill.name;
  }

  /* ------------------------------------------------------------------ HUD */

  function syncHud(state) {
    const hearts = "max:" + state.character.maxLives + state.lives;
    if (cache.hearts !== hearts) {
      cache.hearts = hearts;
      dom.hearts.innerHTML = Array.from({ length: state.character.maxLives }, (_, index) => `<i class="heart ${index < state.lives ? "is-on" : ""}"></i>`).join("");
    }
    if (cache.score !== state.score) {
      cache.score = state.score;
      dom.scoreValue.textContent = state.score.toLocaleString("en-US");
      pop(dom.scoreValue);
    }
    if (cache.coins !== state.coins) {
      cache.coins = state.coins;
      dom.coinValue.textContent = String(state.coins);
      if (state.coinPulse) pop(dom.coinValue);
    }
    if (cache.gems !== state.gems) {
      cache.gems = state.gems;
      dom.gemValue.textContent = String(state.gems);
    }
    dom.distanceLabel.textContent = `${Math.floor(state.distance)} / ${state.level.goal}m`;
    const ratio = Math.min(1, state.distance / state.level.goal);
    dom.progressFill.style.width = `${(ratio * 100).toFixed(1)}%`;

    const comboKey = `${state.multiplier}|${state.combo > 0}`;
    if (cache.combo !== comboKey) {
      cache.combo = comboKey;
      dom.comboValue.textContent = `x${state.multiplier}`;
      dom.comboLine.classList.toggle("is-on", state.combo > 0);
    }
    dom.comboFill.style.width = `${Math.max(0, Math.min(1, state.comboTimer / ns.CONFIG.comboWindow)) * 100}%`;

    const buffKey = [state.magnet > 0 && `磁铁${state.magnet.toFixed(0)}`, state.shield && "护盾", state.star > 0 && `无敌${state.star.toFixed(0)}`, state.rocket > 0 && `火箭${state.rocket.toFixed(0)}`, state.dash > 0 && `冲撞${state.dash.toFixed(0)}`, state.slowmo > 0 && `时缓${state.slowmo.toFixed(0)}`, state.slam > 0 && "蓄力震地"].filter(Boolean).join(",");
    if (cache.buffs !== buffKey) {
      cache.buffs = buffKey;
      dom.buffs.innerHTML = buffKey ? buffKey.split(",").map((label) => `<span class="chip">${label}</span>`).join("") : "";
    }

    const cooldownRatio = state.character.skill.cost ? 1 - state.skillCooldown / state.character.skill.cost : 1;
    dom.skillFill.style.height = `${(1 - Math.max(0, Math.min(1, cooldownRatio))) * 100}%`;
    dom.skillButton.classList.toggle("is-ready", state.skillCooldown <= 0);
    dom.skillButton.disabled = false;
  }

  function pop(element) {
    element.classList.remove("is-pop");
    void element.offsetWidth;
    element.classList.add("is-pop");
  }

  /* ------------------------------------------------------------------ 结算 */

  function showResult(payload) {
    dom.resultKicker.textContent = payload.won ? "Stage Clear" : "Run Failed";
    dom.resultTitle.textContent = payload.won ? "夺旗成功！" : "挑战失败";
    dom.resultTitle.classList.toggle("is-win", payload.won);
    dom.resultStars.innerHTML = payload.won ? starRow(payload.stars) : `<span class="result-fail">${payload.reasonText}</span>`;
    dom.resultScore.textContent = payload.score.toLocaleString("en-US");
    dom.resultRows.innerHTML = [
      ["关卡", payload.levelName],
      ["奔跑距离", `${payload.distance}m / ${payload.goal}m`],
      ["金币 · 宝石", `${payload.coins} · ${payload.gems}`],
      ["最高连击", `x${payload.comboMultiplier}（${payload.bestCombo} 连）`],
      ["踩怪 / 撞碎", `${payload.stomps} 次`],
      ["剩余生命", `${payload.lives} / ${payload.maxLives}`],
      ["用时", `${payload.time.toFixed(1)}s`],
      ["关卡最佳", `${payload.best} 分`],
    ]
      .map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`)
      .join("");
    dom.resultNote.textContent = payload.note;
    dom.resultPrimary.textContent = payload.primaryLabel;
    openScreen("result");
  }

  function setPauseIcon(paused) {
    dom.pauseButton.classList.toggle("is-paused", paused);
  }

  ns.ui = { init, openScreen, setHudVisible, syncHud, showResult, renderCharGrid, refreshStats, setPauseIcon };
})(window.DQM);
