/* 夺旗猫跑酷 · 配置数据：画布、主题、关卡、角色、道具 */
window.DQM = window.DQM || {};

DQM.CONFIG = {
  width: 960,
  height: 540,
  groundY: 426,
  catX: 150,
  gravity: 1850,
  invincibleSeconds: 1.3,
  healCoinCount: 12,
  comboWindow: 2.1,
  comboMax: 8,
  countdown: 3,
};

/* 视觉主题：决定天空、视差、地块配色与氛围粒子 */
DQM.THEMES = {
  morning: {
    label: "晨光",
    sky: [[0, "#63c7f5"], [0.55, "#b8ecff"], [1, "#fff2c4"]],
    sun: { x: 806, y: 92, r: 34, color: "rgba(255,238,170,0.9)" },
    hills: ["rgba(92,161,189,0.28)", "rgba(47,191,113,0.3)"],
    city: { body: "#8fb3c7", lit: "#f4f8ff", rate: 210 },
    prop: "tree",
    propColor: ["#2d9c4d", "#45bd5f"],
    ground: { top: "#6bd85f", body: "#45bd5f", lip: "#2d9c4d", dirt: "#8b5a2b", pebble: "#6f4524", blade: "#7ce06b" },
    platform: { body: "#e0a04a", top: "#ffd166", edge: "#8f5a2a" },
    pipe: { body: "#179c57", cap: "#2fc878", gloss: "rgba(255,255,255,0.22)" },
    ambient: "leaf",
    ambientColor: "rgba(255,241,208,0.85)",
    fog: "rgba(255,247,214,0.14)",
  },
  park: {
    label: "喷泉公园",
    sky: [[0, "#7ad0ff"], [0.5, "#cfefff"], [1, "#ffe9a8"]],
    sun: { x: 150, y: 78, r: 30, color: "rgba(255,247,200,0.92)" },
    hills: ["rgba(70,150,170,0.26)", "rgba(38,168,120,0.32)"],
    city: { body: "#9fc4b4", lit: "#fffbe8", rate: 260 },
    prop: "fountain",
    propColor: ["#2f9e77", "#3ec196"],
    ground: { top: "#72dd68", body: "#43bf61", lip: "#2b9349", dirt: "#7d5230", pebble: "#63401f", blade: "#8aec76" },
    platform: { body: "#d6b06a", top: "#ffe6a8", edge: "#8a6330" },
    pipe: { body: "#189c72", cap: "#31d59a", gloss: "rgba(255,255,255,0.24)" },
    ambient: "petal",
    ambientColor: "rgba(255,183,197,0.9)",
    fog: "rgba(210,255,230,0.12)",
  },
  neon: {
    label: "霓虹后巷",
    sky: [[0, "#141a38"], [0.55, "#2b2a58"], [1, "#5b3164"]],
    sun: { x: 700, y: 70, r: 26, color: "rgba(255,255,255,0.75)" },
    stars: true,
    hills: ["rgba(70,80,140,0.5)", "rgba(46,52,100,0.6)"],
    city: { body: "#2a2f57", lit: "#ffd166", rate: 170 },
    prop: "sign",
    propColor: ["#ff5d8f", "#4dd0ff"],
    ground: { top: "#4a5ab0", body: "#35407f", lip: "#232a58", dirt: "#2a2440", pebble: "#1d1830", blade: "#6a7ad8" },
    platform: { body: "#4c4f8f", top: "#8f9dff", edge: "#2b2c55" },
    pipe: { body: "#2f3a7a", cap: "#5566c8", gloss: "rgba(160,200,255,0.28)" },
    ambient: "spark",
    ambientColor: "rgba(255,190,240,0.85)",
    fog: "rgba(90,60,140,0.2)",
  },
  yard: {
    label: "塔吊工地",
    sky: [[0, "#f8a25c"], [0.5, "#ffca7a"], [1, "#ffe9c2"]],
    sun: { x: 480, y: 150, r: 44, color: "rgba(255,236,170,0.85)" },
    hills: ["rgba(150,100,70,0.3)", "rgba(110,74,52,0.38)"],
    city: { body: "#a5714b", lit: "#ffd9a0", rate: 300 },
    prop: "crane",
    propColor: ["#f0b429", "#8c5a2b"],
    ground: { top: "#c9a06a", body: "#a5763f", lip: "#7d5230", dirt: "#6a4426", pebble: "#533418", blade: "#dcb87f" },
    platform: { body: "#8f9aa6", top: "#cfd8e3", edge: "#5b6470" },
    pipe: { body: "#f0a02a", cap: "#ffd166", gloss: "rgba(255,255,255,0.26)" },
    ambient: "dust",
    ambientColor: "rgba(255,232,200,0.75)",
    fog: "rgba(255,190,120,0.14)",
  },
  rooftop: {
    label: "月光屋顶",
    sky: [[0, "#0b1230"], [0.5, "#1b2b5a"], [1, "#3f5a8a"]],
    sun: { x: 780, y: 76, r: 30, color: "rgba(240,247,255,0.92)" },
    stars: true,
    hills: ["rgba(40,60,105,0.55)", "rgba(28,42,78,0.65)"],
    city: { body: "#1e2748", lit: "#ffe08a", rate: 150 },
    prop: "roof",
    propColor: ["#39477a", "#5468a8"],
    ground: { top: "#5f6f9f", body: "#414f7a", lip: "#2c3556", dirt: "#232a44", pebble: "#171c2e", blade: "#7f92c8" },
    platform: { body: "#55608f", top: "#9fb2ff", edge: "#303754" },
    pipe: { body: "#3a4670", cap: "#6478b8", gloss: "rgba(180,210,255,0.26)" },
    ambient: "star",
    ambientColor: "rgba(255,255,255,0.8)",
    fog: "rgba(30,50,90,0.22)",
  },
  storm: {
    label: "夺旗决战",
    sky: [[0, "#1b1030"], [0.5, "#4a1740"], [1, "#7a2436"]],
    sun: { x: 200, y: 96, r: 38, color: "rgba(255,120,90,0.6)" },
    stars: true,
    hills: ["rgba(60,25,55,0.6)", "rgba(38,16,40,0.7)"],
    city: { body: "#2c1830", lit: "#ff8a5c", rate: 190 },
    prop: "tower",
    propColor: ["#ff5d5d", "#ffb703"],
    ground: { top: "#9a3f4a", body: "#6d2a38", lip: "#4a1b26", dirt: "#33141d", pebble: "#240d14", blade: "#c15c66" },
    platform: { body: "#6b3550", top: "#c05f7a", edge: "#3d1b2c" },
    pipe: { body: "#7a2b3f", cap: "#c04a5e", gloss: "rgba(255,200,200,0.24)" },
    ambient: "ember",
    ambientColor: "rgba(255,160,90,0.9)",
    fog: "rgba(90,20,40,0.24)",
  },
};

/* 关卡：目标距离、速度曲线、生成器权重、星级分数线 */
/* 主题 id 供渲染层做渐变缓存 */
Object.entries(DQM.THEMES).forEach(([id, theme]) => {
  theme.id = id;
});

DQM.LEVELS = [
  {
    id: "l1",
    name: "晨光街区",
    brief: "起步热身：掌握二段跳与踩怪节奏",
    theme: "morning",
    goal: 900,
    startSpeed: 250,
    maxSpeed: 390,
    speedGain: 4.4,
    stars: [2000, 3200, 4600],
    gen: {
      gap: [62, 118], chunk: [300, 500], enemyGap: [72, 92], birdGap: 0,
      pipe: 0.34, floatPlatform: 0.42, moving: 0, spike: 0, gem: 0.1, power: 0.16,
      enemyTypes: ["grunt", "grunt", "sprinter"],
    },
  },
  {
    id: "l2",
    name: "喷泉公园",
    brief: "花瓣与水池之间，留意地面尖刺",
    theme: "park",
    goal: 1100,
    startSpeed: 268,
    maxSpeed: 420,
    speedGain: 5,
    stars: [2400, 3800, 5200],
    gen: {
      gap: [68, 130], chunk: [280, 480], enemyGap: [58, 80], birdGap: 74,
      pipe: 0.36, floatPlatform: 0.5, moving: 0.14, spike: 0.16, gem: 0.18, power: 0.2,
      enemyTypes: ["grunt", "sprinter", "spike"],
    },
  },
  {
    id: "l3",
    name: "霓虹后巷",
    brief: "夜巷危机：飞鸟群与巡逻盾卫",
    theme: "neon",
    goal: 1300,
    startSpeed: 282,
    maxSpeed: 445,
    speedGain: 5.6,
    stars: [3000, 4600, 6200],
    gen: {
      gap: [72, 138], chunk: [270, 470], enemyGap: [58, 78], birdGap: 66,
      pipe: 0.4, floatPlatform: 0.55, moving: 0.22, spike: 0.24, gem: 0.26, power: 0.22,
      enemyTypes: ["grunt", "sprinter", "spike", "shield"],
    },
  },
  {
    id: "l4",
    name: "塔吊工地",
    brief: "黄昏工地：缺口更宽，踏板在移动",
    theme: "yard",
    goal: 1500,
    startSpeed: 296,
    maxSpeed: 468,
    speedGain: 6,
    stars: [3600, 5400, 7200],
    gen: {
      gap: [92, 166], chunk: [250, 440], enemyGap: [52, 72], birdGap: 68,
      pipe: 0.36, floatPlatform: 0.62, moving: 0.38, spike: 0.3, gem: 0.3, power: 0.22,
      enemyTypes: ["sprinter", "spike", "shield", "grunt"],
    },
  },
  {
    id: "l5",
    name: "月光屋顶",
    brief: "高空跳跃走廊，脚下没有第二次机会",
    theme: "rooftop",
    goal: 1700,
    startSpeed: 306,
    maxSpeed: 486,
    speedGain: 6.4,
    stars: [4200, 6200, 8200],
    gen: {
      gap: [104, 176], chunk: [215, 380], enemyGap: [50, 68], birdGap: 60,
      pipe: 0.3, floatPlatform: 0.72, moving: 0.5, spike: 0.34, gem: 0.34, power: 0.24,
      enemyTypes: ["sprinter", "spike", "shield"],
    },
  },
  {
    id: "l6",
    name: "夺旗决战",
    brief: "跑向旗塔，击败夺旗大盗的机械犬",
    theme: "storm",
    goal: 1500,
    startSpeed: 312,
    maxSpeed: 496,
    speedGain: 6.6,
    stars: [5000, 7200, 9600],
    boss: { at: 1240, hp: 3 },
    gen: {
      gap: [92, 158], chunk: [230, 395], enemyGap: [48, 66], birdGap: 56,
      pipe: 0.34, floatPlatform: 0.6, moving: 0.34, spike: 0.32, gem: 0.36, power: 0.26,
      enemyTypes: ["sprinter", "spike", "shield", "grunt"],
    },
  },
];

/* 角色：属性差异 + 专属技能（Shift 或技能按钮释放） */
DQM.CHARACTERS = {
  xiaohei: {
    id: "xiaohei",
    name: "小黑",
    title: "机动型",
    maxLives: 3,
    jumpVelocity: -760,
    jumps: 3,
    width: 62,
    height: 74,
    material: "mecha",
    skill: { kind: "dash", name: "疾影冲撞", cost: 12, duration: 2.2, desc: "2.2 秒无敌并撞碎沿途敌人" },
    accent: "#4dd0ff",
    unlock: { type: "start" },
    blurb: "弹跳最高、可三段跳，代价是只有 3 滴血。",
  },
  dazhuang: {
    id: "dazhuang",
    name: "大壮",
    title: "力量型",
    maxLives: 5,
    jumpVelocity: -630,
    jumps: 2,
    width: 62,
    height: 74,
    material: "dazhuang",
    skill: { kind: "slam", name: "震地猛击", cost: 9, duration: 1.4, desc: "下次落地引发冲击波，清除范围内敌人" },
    accent: "#ffb703",
    unlock: { type: "start" },
    blurb: "5 滴血最抗揍，落地震击能清出一片空地。",
  },
  snowball: {
    id: "snowball",
    name: "雪球",
    title: "控制型",
    maxLives: 4,
    jumpVelocity: -700,
    jumps: 2,
    width: 62,
    height: 74,
    material: "mecha",
    tint: 200,
    skill: { kind: "slowmo", name: "时缓步伐", cost: 11, duration: 3, desc: "3 秒内世界放缓，容错大幅提升" },
    accent: "#c8b6ff",
    unlock: { type: "stars", value: 5, label: "累计获得 5 颗星" },
    blurb: "减慢时间让每一次落点都可精确计算。",
  },
};

DQM.POWERUPS = {
  magnet: { name: "金币磁铁", color: [77, 208, 255], duration: 9, score: 25, glyph: "M" },
  shield: { name: "护盾", color: [139, 211, 255], duration: 0, score: 30, glyph: "S" },
  star: { name: "无敌之星", color: [255, 209, 102], duration: 6.5, score: 40, glyph: "T" },
  heart: { name: "生命 +1", color: [239, 71, 111], duration: 0, score: 20, glyph: "H" },
  rocket: { name: "火箭冲刺", color: [244, 124, 72], duration: 3, score: 35, glyph: "R" },
};

DQM.SCORE = {
  coin: 10,
  gem: 120,
  stomp: 30,
  smash: 20,
  powerup: 25,
  perLifeLeft: 150,
  perGem: 60,
  winBonus: 400,
  comboStepMs: 0,
};

DQM.utils = {  random(min, max) {
    return Math.random() * (max - min) + min;
  },
  randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
  },
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  /* 确定性伪随机：让视差装饰每帧稳定，不闪烁 */
  hash(n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  },
  intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  },
  levelById(id) {
    return DQM.LEVELS.find((level) => level.id === id) || DQM.LEVELS[0];
  },
};
