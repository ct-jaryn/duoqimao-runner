/* 夺旗猫跑酷 · 本地存档：关卡解锁、星级、最高分、角色与设置 */
(function (ns) {
  const KEY = "duoqimao-runner.profile.v1";

  const DEFAULTS = {
    version: 1,
    selectedCharacter: "xiaohei",
    stars: {},
    bestScores: {},
    bestCombo: {},
    cleared: {},
    totalCoins: 0,
    runs: 0,
    settings: { bgm: true, sfx: true, shake: true, quality: "high" },
  };

  let profile = load();

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULTS),
        ...parsed,
        stars: { ...parsed.stars },
        bestScores: { ...parsed.bestScores },
        bestCombo: { ...parsed.bestCombo },
        cleared: { ...parsed.cleared },
        settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      };
    } catch (error) {
      console.warn("存档读取失败，使用默认存档", error);
      return structuredClone(DEFAULTS);
    }
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn("存档写入失败", error);
    }
  }

  function totalStars() {
    return Object.values(profile.stars).reduce((sum, value) => sum + value, 0);
  }

  ns.storage = {
    get profile() {
      return profile;
    },
    totalStars,
    save,
    isLevelUnlocked(levelId) {
      const index = ns.LEVELS.findIndex((level) => level.id === levelId);
      if (index <= 0) return true;
      const previous = ns.LEVELS[index - 1];
      return Boolean(profile.cleared[previous.id]);
    },
    isCharacterUnlocked(characterId) {
      const character = ns.CHARACTERS[characterId];
      if (!character) return false;
      if (character.unlock.type === "start") return true;
      if (character.unlock.type === "stars") return totalStars() >= character.unlock.value;
      if (character.unlock.type === "level") return Boolean(profile.cleared[character.unlock.value]);
      return false;
    },
    selectCharacter(characterId) {
      if (!ns.CHARACTERS[characterId] || !this.isCharacterUnlocked(characterId)) return false;
      profile.selectedCharacter = characterId;
      save();
      return true;
    },
    setSetting(key, value) {
      profile.settings[key] = value;
      save();
    },
    reset() {
      profile = structuredClone(DEFAULTS);
      save();
    },
    /* 记录一局结果，返回 { stars, newBest, unlockedNext } */
    recordRun(levelId, result) {
      const level = ns.utils.levelById(levelId);
      profile.runs += 1;
      profile.totalCoins += result.coins;
      const previousStars = profile.stars[level.id] || 0;
      const previousBest = profile.bestScores[level.id] || 0;
      const stars = result.won ? Math.max(1, result.stars) : 0;
      profile.stars[level.id] = Math.max(previousStars, stars);
      profile.bestScores[level.id] = Math.max(previousBest, result.score);
      profile.bestCombo[level.id] = Math.max(profile.bestCombo[level.id] || 0, result.bestCombo);
      if (result.won) profile.cleared[level.id] = true;
      const index = ns.LEVELS.indexOf(level);
      const next = ns.LEVELS[index + 1];
      save();
      return {
        stars: profile.stars[level.id],
        gainedStars: profile.stars[level.id] - previousStars,
        newBest: result.score > previousBest,
        unlockedNext: Boolean(result.won && next),
        nextLevel: next || null,
      };
    },
  };
})(window.DQM);
