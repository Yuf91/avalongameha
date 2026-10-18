const ROLE_DATA = {
  merlin: {
    name: "梅林", faction: "good", icon: "sparkles", subtitle: "知曉邪惡",
    power: "你看得見邪惡之人，但看不見莫德雷德。"
  },
  percival: {
    name: "派西維爾", faction: "good", icon: "eye", subtitle: "守護梅林",
    power: "你看得見梅林與莫甘娜，但無法分辨兩人。"
  },
  loyal: {
    name: "亞瑟的忠臣", faction: "good", icon: "shield", subtitle: "忠誠無畏",
    power: "你沒有額外情報。觀察言行，找出邪惡。"
  },
  assassin: {
    name: "刺客", faction: "evil", icon: "sword", subtitle: "刺殺梅林",
    power: "若正義完成三次任務，你可刺殺梅林逆轉勝局。"
  },
  morgana: {
    name: "莫甘娜", faction: "evil", icon: "moon", subtitle: "偽裝梅林",
    power: "你會在派西維爾眼中偽裝成梅林。"
  },
  mordred: {
    name: "莫德雷德", faction: "evil", icon: "crown", subtitle: "躲避梅林",
    power: "梅林無法看見你的邪惡身分。"
  },
  oberon: {
    name: "奧伯倫", faction: "evil", icon: "eye-off", subtitle: "孤立邪惡",
    power: "你不認識其他邪惡角色，他們也看不見你。"
  },
  minion: {
    name: "莫德雷德的爪牙", faction: "evil", icon: "skull", subtitle: "邪惡同盟",
    power: "你與其他邪惡角色合作，使任務失敗。"
  },
  lancelotGood: {
    name: "忠誠蘭斯洛特", faction: "good", icon: "swords", subtitle: "可能倒戈",
    power: "你效忠亞瑟，但忠誠牌翻到轉換時，你會改投邪惡陣營。"
  },
  lancelotEvil: {
    name: "邪惡蘭斯洛特", faction: "evil", icon: "swords", subtitle: "可能倒戈",
    power: "你效忠莫德雷德，但忠誠牌翻到轉換時，你會改投忠誠陣營。"
  }
};

const LANCELOTS = ["lancelotGood", "lancelotEvil"];

const PLAYER_SPLIT = {
  5: [3, 2], 6: [4, 2], 7: [4, 3],
  8: [5, 3], 9: [6, 3], 10: [6, 4]
};

const QUESTS = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5]
};

const ROLE_DISPLAY_ORDER = [
  "merlin", "percival", "lancelotGood", "loyal",
  "assassin", "morgana", "mordred", "oberon", "lancelotEvil", "minion"
];

const SAVE_KEY = "avalon-game";
const FLIP_MS = 600;

const state = {
  playerCount: 5,
  names: [],
  selected: new Set(["merlin", "percival", "assassin", "morgana"]),
  setupStep: 0,
  assignments: [],
  revealIndex: 0,
  revealFlipped: false,
  busy: false,
  phase: null,
  quests: [],
  questHistory: [],
  leaderIndex: 0,
  sound: true,
  questTeam: [],
  questVotes: [],
  questVoterIndex: 0,
  pendingQuestResult: null,
  rejectedProposals: 0,
  assassinationResolved: false,
  assassinationTargetIndex: null,
  ladyEnabled: false,
  ladyHolder: null,
  ladyHistory: [],
  ladyUses: [],
  ladyTarget: null,
  lancelotEnabled: false,
  lancelotDeck: [],
  lancelotDraws: [],
  excaliburEnabled: false,
  questTeamIdx: [],
  excaliburHolder: null,
  excaliburTarget: null,
  excaliburUse: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Storage (never throws) ---------- */
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

function init() {
  const pageUrl = new URL(location.href);
  if (pageUrl.searchParams.has("cache-refresh")) {
    pageUrl.searchParams.delete("cache-refresh");
    history.replaceState(null, "", pageUrl);
  }
  let savedNames = [];
  try { savedNames = JSON.parse(storageGet("avalon-player-names") || "[]"); } catch (_) {}
  state.names = Array.from({ length: 10 }, (_, i) => savedNames[i] || `玩家 ${i + 1}`);
  const savedCount = Number(storageGet("avalon-player-count"));
  if (savedCount >= 5 && savedCount <= 10) state.playerCount = savedCount;
  state.sound = storageGet("avalon-sound") !== "off";
  document.body.classList.toggle("light-theme", storageGet("avalon-theme") === "light");

  renderNames();
  renderRoles();
  applyRecommendedRoles();
  updateSetup();
  renderSetupStep();
  bindEvents();
  syncThemeButton();
  syncSoundButton();
  renderResumeCard();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  $("#decreasePlayers").addEventListener("click", () => changePlayerCount(-1));
  $("#increasePlayers").addEventListener("click", () => changePlayerCount(1));
  $("#resetRoles").addEventListener("click", () => {
    applyRecommendedRoles();
    showToast("已套用推薦配置");
  });
  $("#prevStep").addEventListener("click", () => goToStep(state.setupStep - 1));
  $("#nextStep").addEventListener("click", () => {
    if (state.setupStep === 2) startGame();
    else goToStep(state.setupStep + 1);
  });
  $$("#stepper [data-goto]").forEach((button) => {
    button.addEventListener("click", () => goToStep(Number(button.dataset.goto)));
  });
  $("#resumeGame").addEventListener("click", resumeGame);
  $("#discardGame").addEventListener("click", () => {
    if (confirm("確定要捨棄上一局的紀錄嗎？")) {
      clearGame();
      renderResumeCard();
    }
  });

  $("#revealAction").addEventListener("click", handleRevealAction);
  $("#flipCard").addEventListener("click", () => { if (!state.revealFlipped) handleRevealAction(); });

  $("#previousLeader").addEventListener("click", () => changeLeader(-1));
  $("#nextLeader").addEventListener("click", () => changeLeader(1));
  $("#newGame").addEventListener("click", confirmNewGame);
  $("#playAgain").addEventListener("click", () => {
    clearGame();
    backToSetup(0);
  });

  $("#showRules").addEventListener("click", () => $("#rulesDialog").showModal());
  $$("dialog [data-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  $("#soundToggle").addEventListener("click", toggleSound);
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#clearCache").addEventListener("click", clearAppCache);
  $(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    if (!$("#setupScreen").classList.contains("active")) backToSetup(state.setupStep);
  });

  $("#startQuestVote").addEventListener("click", openQuestVote);
  $("#closeQuest").addEventListener("click", requestCloseQuest);
  $("#questDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    requestCloseQuest();
  });
  $("#confirmTeam").addEventListener("click", confirmQuestTeam);
  $$("[data-proposal]").forEach((button) => {
    button.addEventListener("click", () => recordProposalResult(button.dataset.proposal));
  });
  $("#openVote").addEventListener("click", showChaliceChoice);
  $("#confirmSecretVote").addEventListener("click", () => castQuestVote(selectedQuestVote));
  $("#questTrack").addEventListener("click", (event) => {
    const button = event.target.closest("[data-quest-history]");
    if (button) showQuestHistory(Number(button.dataset.questHistory));
  });
  $("#revealQuestResult").addEventListener("click", revealQuestResult);
  $("#finishQuest").addEventListener("click", finishQuestVote);

  $("#ladyToggle").addEventListener("change", (event) => {
    state.ladyEnabled = event.target.checked;
    tone(event.target.checked ? 560 : 340, 0.04);
  });
  $("#lancelotToggle").addEventListener("change", (event) => {
    state.lancelotEnabled = event.target.checked;
    updateRoleSummary();
    tone(event.target.checked ? 560 : 340, 0.04);
  });
  $("#excaliburToggle").addEventListener("change", (event) => {
    state.excaliburEnabled = event.target.checked;
    tone(event.target.checked ? 560 : 340, 0.04);
  });
  $("#drawLoyalty").addEventListener("click", drawLoyalty);
  $("#confirmExcalibur").addEventListener("click", () => showQuestStep("approvalStep"));
  $("#openExcalibur").addEventListener("click", openExcalibur);
  $("#useExcalibur").addEventListener("click", useExcalibur);
  $("#skipExcalibur").addEventListener("click", () => {
    state.excaliburUse = { holder: state.excaliburHolder, target: null };
    showQuestStep("questSealedStep");
  });
  $("#finishExcalibur").addEventListener("click", () => showQuestStep("questSealedStep"));
  $("#startLady").addEventListener("click", openLady);
  $("#confirmLadyTarget").addEventListener("click", () => {
    $("#ladyHolderPass").textContent = state.assignments[state.ladyHolder].name;
    $("#ladyTargetName").textContent = state.assignments[state.ladyTarget].name;
    showLadyStep("ladyPassStep");
  });
  $("#revealLady").addEventListener("click", revealLady);
  $("#finishLady").addEventListener("click", finishLady);
  $("#closeLady").addEventListener("click", requestCloseLady);
  $("#ladyDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    requestCloseLady();
  });

  $("#startAssassination").addEventListener("click", openAssassination);
  $("#confirmAssassination").addEventListener("click", confirmAssassination);
  $("#finishAssassination").addEventListener("click", () => $("#assassinationDialog").close());
}

/* ---------- Setup wizard ---------- */
function goToStep(step) {
  if (step < 0 || step > 2) return;
  if (step === 2 && state.setupStep < 2) {
    if (state.setupStep !== 1) {
      state.setupStep = 1;
      renderSetupStep();
    }
    if (!validateNames()) return;
  }
  state.setupStep = step;
  renderSetupStep();
  $(`.setup-step[data-step="${step}"] .step-title`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  tone(420, 0.04);
}

function renderSetupStep() {
  const step = state.setupStep;
  $$(".setup-step").forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.step) === step);
  });
  $$("#stepper li").forEach((item, index) => {
    item.classList.toggle("done", index < step);
    const button = item.querySelector("button");
    if (index === step) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $("#prevStep").classList.toggle("hidden", step === 0);
  $("#setupScreen .action-bar").classList.toggle("single", step === 0);
  $("#nextStep").textContent = step === 2 ? "開始抽籤" : "下一步";
  updateRoleSummary();
}

function changePlayerCount(delta) {
  const next = Math.max(5, Math.min(10, state.playerCount + delta));
  if (next === state.playerCount) return;
  state.playerCount = next;
  storageSet("avalon-player-count", String(next));
  renderNames();
  applyRecommendedRoles();
  updateSetup();
  tone(360 + next * 20, 0.04);
}

function updateSetup() {
  const [good, evil] = PLAYER_SPLIT[state.playerCount];
  $("#playerCount").textContent = state.playerCount;
  $("#goodCount").textContent = good;
  $("#evilCount").textContent = evil;
  $("#goodSlots").textContent = `${good} 位`;
  $("#evilSlots").textContent = `${evil} 位`;
  $("#decreasePlayers").disabled = state.playerCount === 5;
  $("#increasePlayers").disabled = state.playerCount === 10;
  $("#questPreview").innerHTML = QUESTS[state.playerCount].map((size, index) => {
    const twoFails = state.playerCount >= 7 && index === 3;
    return `<span class="${twoFails ? "two-fails" : ""}" title="${twoFails ? "需 2 張失敗票" : ""}">${size}</span>`;
  }).join("") + (state.playerCount >= 7 ? `<small>第 4 局需 2 張失敗票</small>` : "");
  updateRoleSummary();
}

function renderNames() {
  $("#nameList").innerHTML = Array.from({ length: state.playerCount }, (_, i) => `
    <label class="player-name">
      <span class="seat">${i + 1}</span>
      <input type="text" maxlength="12" value="${escapeHtml(state.names[i])}" placeholder="玩家 ${i + 1}"
        aria-label="第 ${i + 1} 位玩家名稱" enterkeyhint="${i === state.playerCount - 1 ? "done" : "next"}">
    </label>
  `).join("");

  $$("#nameList input").forEach((input, index, inputs) => {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
      state.names[index] = input.value.trim() || `玩家 ${index + 1}`;
      storageSet("avalon-player-names", JSON.stringify(state.names));
      if ($("#nameError").textContent) validateNames(false);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (inputs[index + 1]) inputs[index + 1].focus();
      else input.blur();
    });
  });
}

function validateNames(moveFocus = true) {
  const inputs = $$("#nameList input");
  const names = inputs.map((input, i) => input.value.trim() || `玩家 ${i + 1}`);
  const seen = new Map();
  const duplicates = new Set();
  names.forEach((name, index) => {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates.add(index);
      duplicates.add(seen.get(key));
    } else {
      seen.set(key, index);
    }
  });
  inputs.forEach((input, index) => {
    input.closest(".player-name").classList.toggle("invalid", duplicates.has(index));
    input.setAttribute("aria-invalid", String(duplicates.has(index)));
  });
  $("#nameError").textContent = duplicates.size ? "玩家名稱重複，請修改標示的欄位，避免情報混淆。" : "";
  if (duplicates.size && moveFocus) inputs[[...duplicates][0]].focus();
  return duplicates.size === 0;
}

function renderRoles() {
  const goodIds = ["merlin", "percival"];
  const evilIds = ["assassin", "morgana", "mordred", "oberon"];
  $("#goodRoles").innerHTML = goodIds.map(roleOptionTemplate).join("");
  $("#evilRoles").innerHTML = evilIds.map(roleOptionTemplate).join("");

  $$("#goodRoles input, #evilRoles input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selected.add(input.value);
      else state.selected.delete(input.value);
      enforceRoleDependencies(input.value);
      syncRoleInputs();
      updateRoleSummary();
      tone(input.checked ? 560 : 340, 0.04);
    });
  });
}

function roleOptionTemplate(id) {
  const role = ROLE_DATA[id];
  return `
    <label class="role-option ${role.faction}">
      <input type="checkbox" value="${id}">
      <span class="role-art">${icon(role.icon)}</span>
      <b>${role.name}</b>
      <small>${role.subtitle}</small>
      <span class="role-check">${icon("check")}</span>
    </label>
  `;
}

function enforceRoleDependencies(changedId) {
  if (changedId === "morgana" && state.selected.has("morgana") && !state.selected.has("percival")) {
    state.selected.add("percival");
    showToast("莫甘娜需搭配派西維爾，已一併加入");
  }
  if (changedId === "percival" && !state.selected.has("percival") && state.selected.has("morgana")) {
    state.selected.delete("morgana");
    showToast("沒有派西維爾時莫甘娜無作用，已一併移除");
  }
}

function syncRoleInputs() {
  $$("#goodRoles input, #evilRoles input").forEach((input) => {
    input.checked = state.selected.has(input.value);
  });
  $("#ladyToggle").checked = state.ladyEnabled;
  $("#lancelotToggle").checked = state.lancelotEnabled;
  $("#excaliburToggle").checked = state.excaliburEnabled;
}

function applyRecommendedRoles() {
  const recommended = ["merlin", "percival", "assassin", "morgana"];
  if (state.playerCount >= 7) recommended.push("mordred");
  if (state.playerCount === 10) recommended.push("oberon");
  state.selected = new Set(recommended);
  state.ladyEnabled = state.playerCount >= 7;
  state.lancelotEnabled = false;
  state.excaliburEnabled = false;
  syncRoleInputs();
  updateRoleSummary();
}

function updateRoleSummary() {
  const [goodSlots, evilSlots] = PLAYER_SPLIT[state.playerCount];
  const lancelot = state.lancelotEnabled ? 1 : 0;
  const selectedGood = [...state.selected].filter((id) => ROLE_DATA[id].faction === "good").length + lancelot;
  const selectedEvil = [...state.selected].filter((id) => ROLE_DATA[id].faction === "evil").length + lancelot;
  const valid = selectedGood <= goodSlots && selectedEvil <= evilSlots;
  const summary = $("#roleSummary");
  summary.classList.toggle("error", !valid);
  summary.textContent = valid
    ? `其餘將補入 ${goodSlots - selectedGood} 位忠臣、${evilSlots - selectedEvil} 位爪牙`
    : selectedEvil > evilSlots
      ? `邪惡角色超過 ${evilSlots} 位，請取消 ${selectedEvil - evilSlots} 個`
      : `忠誠角色超過 ${goodSlots} 位，請取消 ${selectedGood - goodSlots} 個`;
  if (!valid && lancelot) summary.textContent += "（蘭斯洛特佔忠、邪各 1 位）";
  if (state.setupStep === 2) $("#nextStep").disabled = !valid;
  else $("#nextStep").disabled = false;
  return valid;
}

function startGame() {
  if (!validateNames()) {
    goToStep(1);
    return;
  }
  if (!updateRoleSummary()) return;

  state.names = $$("#nameList input").map((input, i) => input.value.trim() || `玩家 ${i + 1}`)
    .concat(state.names.slice(state.playerCount));
  const [goodSlots, evilSlots] = PLAYER_SPLIT[state.playerCount];
  const roles = [...state.selected];
  if (state.lancelotEnabled) roles.push(...LANCELOTS);
  const selectedGood = roles.filter((id) => ROLE_DATA[id].faction === "good").length;
  const selectedEvil = roles.filter((id) => ROLE_DATA[id].faction === "evil").length;
  roles.push(...Array(goodSlots - selectedGood).fill("loyal"));
  roles.push(...Array(evilSlots - selectedEvil).fill("minion"));

  const shuffledRoles = shuffle(roles);
  state.assignments = state.names.slice(0, state.playerCount)
    .map((name, index) => ({ name, role: shuffledRoles[index] }));
  state.revealIndex = 0;
  state.quests = [];
  state.questHistory = [];
  state.leaderIndex = randomInt(state.playerCount);
  state.rejectedProposals = 0;
  state.assassinationResolved = false;
  state.assassinationTargetIndex = null;
  // The Lady starts with the player to the leader's right (previous seat).
  state.ladyHolder = state.ladyEnabled ? (state.leaderIndex - 1 + state.playerCount) % state.playerCount : null;
  state.ladyHistory = state.ladyEnabled ? [state.ladyHolder] : [];
  state.ladyUses = [];
  state.lancelotDeck = state.lancelotEnabled ? shuffle(["stay", "stay", "stay", "switch", "switch"]) : [];
  state.lancelotDraws = [];
  state.phase = "reveal";
  saveGame();
  prepareReveal();
  showScreen("revealScreen");
  tone(520, 0.08);
}

/* ---------- Card reveal ---------- */
function prepareReveal() {
  const current = state.assignments[state.revealIndex];
  state.revealFlipped = false;
  $("#flipCard").classList.remove("flipped");
  $("#cardFront").setAttribute("aria-hidden", "true");
  $("#revealInfo").hidden = true;
  $("#revealHint").hidden = false;
  $("#turnCount").textContent = `第 ${state.revealIndex + 1} 位／共 ${state.assignments.length} 位`;
  $("#currentPlayerName").textContent = current.name;
  $("#revealAction").textContent = "翻開身分牌";
  $("#revealProgress").innerHTML = state.assignments.map((_, index) =>
    `<i class="${index < state.revealIndex ? "done" : index === state.revealIndex ? "current" : ""}"></i>`
  ).join("");
}

function handleRevealAction() {
  if (state.busy) return;
  if (!state.revealFlipped) flipCard();
  else concealAndContinue();
}

function flipCard() {
  const assignment = state.assignments[state.revealIndex];
  const role = ROLE_DATA[assignment.role];
  const front = $("#cardFront");
  front.className = `card-face card-front ${role.faction}`;
  front.setAttribute("aria-hidden", "false");
  $("#cardFaction").textContent = role.faction === "good" ? "忠誠陣營" : "邪惡陣營";
  $("#cardIcon").setAttribute("href", `#i-${role.icon}`);
  $("#cardName").textContent = role.name;
  $("#cardSubtitle").textContent = role.subtitle;
  $("#rolePower").textContent = role.power;
  $("#roleKnowledge").textContent = buildKnowledge(assignment);

  $("#revealInfo").className = `reveal-info ${role.faction}`;
  $("#revealInfo").hidden = false;
  $("#revealHint").hidden = true;
  $("#flipCard").classList.add("flipped");
  state.revealFlipped = true;
  const last = state.revealIndex === state.assignments.length - 1;
  $("#revealAction").textContent = last ? "我已記住，蓋牌並開始遊戲" : "我已記住，蓋牌";
  // Same sound for every role so bystanders can't hear which faction was drawn.
  tone(560, 0.1);
  vibrate(20);
}

function concealAndContinue() {
  state.busy = true;
  state.revealFlipped = false;
  $("#flipCard").classList.remove("flipped");
  $("#revealInfo").hidden = true;
  $("#cardFront").setAttribute("aria-hidden", "true");
  tone(400, 0.05);

  // Wait for the card to turn face-down before loading the next player.
  setTimeout(() => {
    state.busy = false;
    state.revealIndex += 1;
    if (state.revealIndex < state.assignments.length) {
      saveGame();
      prepareReveal();
      $(".pass-title").focus({ preventScroll: true });
    } else {
      state.phase = "board";
      saveGame();
      renderGame();
      showScreen("gameScreen");
    }
  }, reducedMotion() ? 0 : FLIP_MS);
}

function buildKnowledge(assignment) {
  const roleId = assignment.role;
  const playersWithRoles = (...ids) => state.assignments
    .filter((player) => ids.includes(player.role))
    .map((player) => player.name);

  if (roleId === "merlin") {
    const visibleEvil = state.assignments
      .filter((player) => ROLE_DATA[player.role].faction === "evil" && player.role !== "mordred")
      .map((player) => player.name);
    return visibleEvil.length ? `${visibleEvil.join("、")} 散發著邪惡氣息。` : "你沒有看見任何邪惡氣息。";
  }

  if (roleId === "percival") {
    const candidates = playersWithRoles("merlin", "morgana");
    return candidates.length ? `${candidates.join("、")} 可能是梅林。` : "本局沒有梅林或莫甘娜可供辨識。";
  }

  if (roleId === "oberon") {
    return "你孤身行動，不知道其他邪惡角色的身分。";
  }

  if (ROLE_DATA[roleId].faction === "evil") {
    const allies = state.assignments
      .filter((player) =>
        player.name !== assignment.name &&
        ROLE_DATA[player.role].faction === "evil" &&
        player.role !== "oberon"
      )
      .map((player) => player.name);
    return allies.length ? `你的邪惡同伴是：${allies.join("、")}。` : "你沒有可辨識的邪惡同伴。";
  }

  if (roleId === "lancelotGood") {
    return "你沒有額外情報。留意忠誠牌，你的陣營可能改變。";
  }

  return "你只知道自己的忠誠。請從討論與投票中尋找線索。";
}

/* Current faction, accounting for Lancelot loyalty switches. */
function lancelotSwitched() {
  return state.lancelotDraws.filter((card) => card === "switch").length % 2 === 1;
}

function factionOf(player) {
  const base = ROLE_DATA[player.role].faction;
  if (!LANCELOTS.includes(player.role) || !lancelotSwitched()) return base;
  return base === "good" ? "evil" : "good";
}

/* ---------- Game board ---------- */
function getStatus() {
  const successes = state.quests.filter((result) => result === "success").length;
  const failures = state.quests.filter((result) => result === "failure").length;
  const hasAssassination = state.assignments.some((player) => player.role === "assassin")
    && state.assignments.some((player) => player.role === "merlin");
  const base = { successes, failures, over: false, assassination: false };

  if (state.rejectedProposals >= 5) return { ...base, over: true, winner: "evil", reason: "連續五次組隊未通過。" };
  if (failures >= 3) return { ...base, over: true, winner: "evil", reason: "三次任務遭到破壞。" };
  if (successes >= 3) {
    if (!hasAssassination) return { ...base, over: true, winner: "good", reason: "完成三次任務。" };
    if (!state.assassinationResolved) return { ...base, assassination: true };
    const target = state.assignments[state.assassinationTargetIndex];
    const hit = target?.role === "merlin";
    return {
      ...base, over: true, winner: hit ? "evil" : "good",
      reason: hit ? `刺客找出了梅林（${target.name}）。` : `刺客誤刺了 ${target?.name}，梅林安全。`
    };
  }
  return base;
}

function renderGame() {
  const status = getStatus();
  renderScore(status);
  renderQuests(status);
  renderQuestCard(status);
  renderLeader();
  renderRejections();
  renderLady();
  renderLancelot();
  renderRoster(status);
}

function needsLoyaltyDraw(status = getStatus()) {
  const done = state.quests.length;
  return state.lancelotEnabled && !status.over && !status.assassination
    && done >= 2 && done <= 4 && state.lancelotDraws.length < done - 1 && !needsLady(status);
}

function renderLancelot() {
  $("#lancelotCard").classList.toggle("hidden", !state.lancelotEnabled);
  if (!state.lancelotEnabled) return;
  $("#lancelotState").textContent = lancelotSwitched() ? "目前已倒戈（陣營互換）" : "目前為原陣營";
  $("#lancelotHistory").textContent = state.lancelotDraws.length
    ? state.lancelotDraws.map((card, i) => `第 ${i + 3} 局前：${card === "switch" ? "轉換" : "不變"}`).join("\n")
    : "第 3、4、5 局開始前各翻一張";
}

function drawLoyalty() {
  if (!needsLoyaltyDraw()) return;
  const card = state.lancelotDeck[state.lancelotDraws.length];
  state.lancelotDraws.push(card);
  saveGame();
  renderGame();
  const switched = card === "switch";
  $("#loyaltyIcon").className = `pass-icon ${switched ? "evil" : ""}`;
  $("#loyaltyIcon use").setAttribute("href", `#i-${switched ? "repeat" : "swords"}`);
  $("#loyaltyWho").textContent = `第 ${state.quests.length + 1} 局忠誠牌`;
  const title = $("#loyaltyTitle");
  title.textContent = switched ? "陣營轉換！" : "維持不變";
  title.className = `result-title ${switched ? "evil" : "good"}`;
  $("#loyaltyCopy").textContent = switched
    ? `兩位蘭斯洛特交換陣營，${lancelotSwitched() ? "現在各自倒戈。" : "現在回到原本的陣營。"}`
    : "兩位蘭斯洛特維持目前的陣營。";
  $("#loyaltyDialog").showModal();
  tone(switched ? 300 : 600, 0.12);
}

function needsLady(status = getStatus()) {
  const done = state.quests.length;
  return state.ladyEnabled && !status.over && !status.assassination
    && done >= 2 && done <= 4 && state.ladyUses.length < done - 1;
}

function renderLady() {
  $("#ladyCard").classList.toggle("hidden", !state.ladyEnabled);
  if (!state.ladyEnabled) return;
  const name = (index) => state.assignments[index]?.name || "";
  $("#ladyHolderName").textContent = name(state.ladyHolder);
  $("#ladyHistory").textContent = state.ladyUses.length
    ? state.ladyUses.map((use) => `第 ${use.quest} 局後：${name(use.holder)} 查驗 ${name(use.target)}`).join("\n")
    : "第 2、3、4 局任務結束後使用";
}

function renderScore(status) {
  $("#goodScore").textContent = status.successes;
  $("#evilScore").textContent = status.failures;
}

function renderQuests(status) {
  const questSizes = QUESTS[state.playerCount];
  const currentQuest = state.quests.length;
  $("#questTrack").innerHTML = questSizes.map((size, index) => {
    const result = state.quests[index];
    const isCurrent = index === currentQuest && !status.over && !status.assassination;
    const needsTwoFails = state.playerCount >= 7 && index === 3;
    const label = result === "success" ? "成功" : result === "failure" ? "失敗" : isCurrent ? "進行中" : "未開始";
    const face = result === "success" ? icon("check") : result === "failure" ? icon("x") : index + 1;
    return `
      <li class="quest-token ${result || ""} ${isCurrent ? "current" : ""}" aria-label="第 ${index + 1} 局，${size} 人，${label}${needsTwoFails ? "，需 2 張失敗票" : ""}">
        <button type="button" class="token" data-quest-history="${index}" aria-label="查看第 ${index + 1} 局紀錄" ${result ? "" : "disabled"}>${face}${needsTwoFails ? `<i class="two-fail">2</i>` : ""}</button>
        <span class="token-size">${size} 人</span>
      </li>
    `;
  }).join("");
}

function showQuestHistory(index) {
  const result = state.quests[index];
  if (!result) return;
  const record = state.questHistory[index];
  $("#historyTitle").textContent = `第 ${index + 1} 局・任務${result === "success" ? "成功" : "失敗"}`;
  $("#historyTeam").textContent = record ? record.team.join("、") : "此局為舊版紀錄，未儲存出征名單。";
  $("#historyTally").textContent = record ? `${record.successes} 張成功 · ${record.failures} 張失敗` : "此局未儲存票數。";
  $("#historyExcalibur").textContent = record?.excalibur || "";
  $("#questHistoryDialog").showModal();
}

function renderQuestCard(status) {
  const card = $("#questCard");
  card.className = "quest-card";
  $("#startQuestVote").classList.add("hidden");
  $("#startLady").classList.add("hidden");
  $("#drawLoyalty").classList.add("hidden");
  $("#startAssassination").classList.add("hidden");
  $("#playAgain").classList.add("hidden");

  if (status.over) {
    card.classList.add("finished", status.winner);
    $("#questKicker").textContent = "遊戲結束";
    $("#questHeadline").textContent = status.winner === "good" ? "忠誠陣營獲勝" : "邪惡陣營獲勝";
    $("#questNote").textContent = status.reason;
    $("#playAgain").classList.remove("hidden");
    return;
  }

  if (status.assassination) {
    card.classList.add("assassination");
    $("#questKicker").textContent = "正義完成三次任務";
    $("#questHeadline").textContent = "刺客的最後機會";
    $("#questNote").textContent = "邪惡陣營可公開討論，由刺客指認一位玩家為梅林。";
    $("#startAssassination").classList.remove("hidden");
    return;
  }

  if (needsLady(status)) {
    card.classList.add("lady");
    $("#questKicker").textContent = `第 ${state.quests.length} 局任務結束`;
    $("#questHeadline").textContent = `湖中女神：${state.assignments[state.ladyHolder].name}`;
    $("#questNote").textContent = "查驗一位玩家的陣營，再把湖中女神交給對方。";
    $("#startLady").classList.remove("hidden");
    return;
  }

  if (needsLoyaltyDraw(status)) {
    card.classList.add("lady");
    $("#questKicker").textContent = `第 ${state.quests.length + 1} 局開始前`;
    $("#questHeadline").textContent = "蘭斯洛特忠誠牌";
    $("#questNote").textContent = "公開翻開一張忠誠牌，決定兩位蘭斯洛特是否交換陣營。";
    $("#drawLoyalty").classList.remove("hidden");
    return;
  }

  const next = state.quests.length;
  const size = QUESTS[state.playerCount][next];
  const twoFails = state.playerCount >= 7 && next === 3;
  $("#questKicker").textContent = `第 ${next + 1} 局任務`;
  $("#questHeadline").textContent = `由 ${state.assignments[state.leaderIndex].name} 派出 ${size} 人`;
  $("#questNote").textContent = twoFails ? "本局需要至少兩張失敗票，任務才會失敗。" : "只要一張失敗票，任務就會失敗。";
  $("#startQuestVote").classList.remove("hidden");
}

function renderLeader() {
  $("#leaderName").textContent = state.assignments[state.leaderIndex]?.name || "";
}

function renderRejections() {
  const count = state.rejectedProposals;
  $("#rejectionCount").textContent = `${count} / 5`;
  $("#rejectionCount").classList.toggle("warn", count >= 3);
  $("#rejectPips").innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < count ? "on" : ""} ${i === 4 ? "last" : ""}">${i === 4 ? icon("skull") : ""}</i>`
  ).join("");
}

function renderRoster(status) {
  if (status.over) {
    $("#rosterLabel").textContent = "身分揭曉";
    $("#roster").className = "roster reveal";
    $("#roster").innerHTML = state.assignments.map((player) => {
      const role = ROLE_DATA[player.role];
      const turned = LANCELOTS.includes(player.role) && lancelotSwitched() ? "（倒戈）" : "";
      return `<span class="roster-row ${factionOf(player)}">${icon(role.icon)}<b>${escapeHtml(player.name)}</b><small>${role.name}${turned}</small></span>`;
    }).join("");
    return;
  }
  $("#rosterLabel").textContent = "本局角色";
  $("#roster").className = "roster";
  $("#roster").innerHTML = state.assignments
    .map(({ role }) => role)
    .sort((a, b) => ROLE_DISPLAY_ORDER.indexOf(a) - ROLE_DISPLAY_ORDER.indexOf(b))
    .map((role) => `<span class="role-chip ${ROLE_DATA[role].faction}">${icon(ROLE_DATA[role].icon)}${ROLE_DATA[role].name}</span>`)
    .join("");
}

function changeLeader(delta) {
  state.leaderIndex = (state.leaderIndex + delta + state.assignments.length) % state.assignments.length;
  saveGame();
  renderLeader();
  renderQuestCard(getStatus());
  tone(420, 0.04);
}

/* ---------- Quest flow ---------- */
function openQuestVote() {
  const status = getStatus();
  if (status.over || status.assassination || needsLady(status) || needsLoyaltyDraw(status)) return;

  const required = QUESTS[state.playerCount][state.quests.length];
  state.questTeam = [];
  state.questVotes = [];
  state.questVoterIndex = 0;
  state.pendingQuestResult = null;
  state.excaliburHolder = null;
  state.excaliburUse = null;
  $("#teamStepTitle").textContent = `選擇 ${required} 位出征隊員`;
  $("#teamOptions").innerHTML = state.assignments.map((player, index) => `
    <label class="chip">
      <input type="checkbox" value="${index}">
      <span>${index === state.leaderIndex ? icon("crown") : ""}${escapeHtml(player.name)}</span>
    </label>
  `).join("");
  $$("#teamOptions input").forEach((input) => input.addEventListener("change", updateTeamSelection));
  showQuestStep("teamStep");
  $("#questDialog").showModal();
  updateTeamSelection();
}

function updateTeamSelection() {
  const required = QUESTS[state.playerCount][state.quests.length];
  const checked = $$("#teamOptions input:checked");
  $$("#teamOptions input:not(:checked)").forEach((input) => {
    input.disabled = checked.length >= required;
  });
  $("#confirmTeam").disabled = checked.length !== required;
  $("#teamStepCopy").textContent = checked.length === required
    ? "名單已完成，請在現場舉手表決。"
    : `已選 ${checked.length} / ${required} 位`;
}

function confirmQuestTeam() {
  state.questTeamIdx = $$("#teamOptions input:checked").map((input) => Number(input.value));
  state.questTeam = state.questTeamIdx.map((index) => state.assignments[index]);
  if (!state.excaliburEnabled) {
    showQuestStep("approvalStep");
    return;
  }
  const leader = state.assignments[state.leaderIndex];
  $("#excaliburGiveTitle").textContent = `${leader.name}，交出王者之劍`;
  $("#excaliburOptions").innerHTML = state.questTeamIdx
    .filter((index) => index !== state.leaderIndex)
    .map((index) => `
      <label class="chip">
        <input type="radio" name="excalibur-holder" value="${index}">
        <span>${escapeHtml(state.assignments[index].name)}</span>
      </label>
    `).join("");
  $$("#excaliburOptions input").forEach((input) => {
    input.addEventListener("change", () => {
      state.excaliburHolder = Number(input.value);
      $("#confirmExcalibur").disabled = false;
    });
  });
  $("#confirmExcalibur").disabled = true;
  showQuestStep("excaliburGiveStep");
}

function openExcalibur() {
  state.excaliburTarget = null;
  $("#excaliburTargets").innerHTML = state.questTeamIdx
    .filter((index) => index !== state.excaliburHolder)
    .map((index) => `
      <label class="chip">
        <input type="radio" name="excalibur-target" value="${index}">
        <span>${escapeHtml(state.assignments[index].name)}</span>
      </label>
    `).join("");
  $$("#excaliburTargets input").forEach((input) => {
    input.addEventListener("change", () => {
      state.excaliburTarget = Number(input.value);
      $("#useExcalibur").disabled = false;
    });
  });
  $("#useExcalibur").disabled = true;
  showQuestStep("excaliburUseStep");
}

function useExcalibur() {
  if (state.excaliburTarget === null) return;
  const position = state.questTeamIdx.indexOf(state.excaliburTarget);
  const original = state.questVotes[position];
  const flipped = original === "success" ? "failure" : "success";
  state.questVotes[position] = flipped;
  state.excaliburUse = { holder: state.excaliburHolder, target: state.excaliburTarget };
  $("#excaliburResultWho").textContent = `${state.assignments[state.excaliburTarget].name} 原本投下`;
  const title = $("#excaliburResultTitle");
  title.textContent = original === "success" ? "成功" : "失敗";
  title.className = `result-title ${original === "success" ? "good" : "evil"}`;
  $("#excaliburResultCopy").textContent = `已翻轉為「${flipped === "success" ? "成功" : "失敗"}」。請將裝置交回。`;
  showQuestStep("excaliburResultStep");
  // Same sound whatever the original card was.
  tone(500, 0.06);
  vibrate(15);
}

function recordProposalResult(result) {
  if (result === "approve") {
    state.rejectedProposals = 0;
    state.questVoterIndex = 0;
    saveGame();
    renderRejections();
    prepareQuestVoter();
    showQuestStep("votePassStep");
    tone(580, 0.06);
    return;
  }

  state.rejectedProposals += 1;
  tone(240, 0.06);
  $("#questDialog").close();
  changeLeader(1);
  saveGame();
  renderGame();
  showToast(state.rejectedProposals >= 5
    ? "連續五次組隊未通過，邪惡陣營獲勝"
    : `組隊未通過，改由 ${state.assignments[state.leaderIndex].name} 擔任隊長`);
}

function prepareQuestVoter() {
  const voter = state.questTeam[state.questVoterIndex];
  $("#voteTurnCount").textContent = `第 ${state.questVoterIndex + 1} 票／共 ${state.questTeam.length} 票`;
  $("#voterName").textContent = voter.name;
}

let selectedQuestVote = null;

function showChaliceChoice() {
  const voter = state.questTeam[state.questVoterIndex];
  const isGood = factionOf(voter) === "good";
  selectedQuestVote = null;
  $("#chaliceVoter").textContent = voter.name;
  $("#confirmSecretVote").disabled = true;
  const ballots = shuffle(isGood ? ["success", "success"] : ["success", "failure"]);
  $("#secretBallots").innerHTML = ballots.map((vote) => `
    <button class="choice-card secret-ballot ${vote === "failure" ? "evil" : ""}" data-vote="${vote}" type="button" aria-pressed="false">
      ${icon(vote === "failure" ? "skull" : "chalice")}<b>${vote === "success" ? "成功" : "失敗"}</b>
    </button>
  `).join("");
  $$("#secretBallots button").forEach((button) => button.addEventListener("click", () => {
    selectedQuestVote = button.dataset.vote;
    $$("#secretBallots button").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
    $("#confirmSecretVote").disabled = false;
  }));
  $("#voteWarning").textContent = isGood ? "忠誠陣營的兩張選票皆為成功，任選一張後確認。" : "選票位置每次隨機，請看清楚後選擇。";
  showQuestStep("chaliceStep");
}

function castQuestVote(vote) {
  if (currentQuestStep() !== "chaliceStep" || !["success", "failure"].includes(vote)) return;
  const voter = state.questTeam[state.questVoterIndex];
  if (vote === "failure" && factionOf(voter) === "good") return;
  state.questVotes.push(vote);
  selectedQuestVote = null;
  $("#secretBallots").replaceChildren();
  $("#confirmSecretVote").disabled = true;
  state.questVoterIndex += 1;
  tone(500, 0.06);
  vibrate(15);

  if (state.questVoterIndex < state.questTeam.length) {
    prepareQuestVoter();
    showQuestStep("votePassStep");
    return;
  }
  if (state.excaliburEnabled && state.excaliburHolder !== null) {
    $("#excaliburHolderName").textContent = state.assignments[state.excaliburHolder].name;
    showQuestStep("excaliburPassStep");
    return;
  }
  showQuestStep("questSealedStep");
}

function revealQuestResult() {
  const failures = state.questVotes.filter((vote) => vote === "failure").length;
  const requiredFailures = state.playerCount >= 7 && state.quests.length === 3 ? 2 : 1;
  const result = failures >= requiredFailures ? "failure" : "success";
  state.pendingQuestResult = result;
  $("#voteReveal").innerHTML = shuffle(state.questVotes).map((vote, index) => `
    <span class="vote-card ${vote === "success" ? "good" : "evil"}" style="--i:${index}">
      ${icon(vote === "success" ? "chalice" : "skull")}
    </span>
  `).join("");
  const title = $("#questResultTitle");
  title.textContent = result === "success" ? "任務成功" : "任務失敗";
  title.className = `result-title ${result === "success" ? "good" : "evil"}`;
  $("#resultTally").textContent = `${state.questVotes.length - failures} 張成功 · ${failures} 張失敗`;
  const use = state.excaliburUse;
  const name = (index) => state.assignments[index]?.name;
  $("#excaliburNote").textContent = !use ? ""
    : use.target === null ? `王者之劍：${name(use.holder)} 未使用`
      : `王者之劍：${name(use.holder)} 翻轉了 ${name(use.target)} 的票`;
  showQuestStep("questResultStep");
  setTimeout(() => tone(result === "success" ? 700 : 180, 0.14), reducedMotion() ? 0 : 200 * state.questVotes.length);
}

function finishQuestVote() {
  const result = state.pendingQuestResult;
  if (!result) return;
  const failures = state.questVotes.filter((vote) => vote === "failure").length;
  state.questHistory[state.quests.length] = {
    team: state.questTeam.map((player) => player.name),
    result,
    successes: state.questVotes.length - failures,
    failures,
    excalibur: $("#excaliburNote").textContent
  };
  state.quests.push(result);
  state.pendingQuestResult = null;
  state.questVotes = [];
  $("#questDialog").close();
  changeLeader(1);
  saveGame();
  renderGame();
  showToast(result === "success" ? "任務成功" : "任務失敗");
}

function currentQuestStep() {
  return $(".quest-step.active")?.id;
}

function requestCloseQuest() {
  const step = currentQuestStep();
  if (step === "questResultStep") {
    finishQuestVote();
    return;
  }
  const midVote = ["votePassStep", "chaliceStep", "excaliburPassStep", "excaliburUseStep",
    "excaliburResultStep", "questSealedStep"].includes(step);
  if (midVote && !confirm("要放棄本次任務投票嗎？已投的票將作廢。")) return;
  state.questVotes = [];
  $("#questDialog").close();
}

function showQuestStep(id) {
  $$(".quest-step").forEach((step) => step.classList.toggle("active", step.id === id));
  const heading = $(`#${id} h2`);
  $("#questDialog").setAttribute("aria-labelledby", heading.id || (heading.id = `${id}Title`));
}

/* ---------- Lady of the Lake ---------- */
function openLady() {
  if (!needsLady()) return;
  const holder = state.assignments[state.ladyHolder];
  state.ladyTarget = null;
  $("#ladyPickTitle").textContent = `${holder.name}，選擇要查驗的玩家`;
  $("#ladyOptions").innerHTML = state.assignments
    .map((player, index) => ({ player, index }))
    .filter(({ index }) => !state.ladyHistory.includes(index))
    .map(({ player, index }) => `
      <label class="chip">
        <input type="radio" name="lady-target" value="${index}">
        <span>${escapeHtml(player.name)}</span>
      </label>
    `).join("");
  $$("#ladyOptions input").forEach((input) => {
    input.addEventListener("change", () => {
      state.ladyTarget = Number(input.value);
      $("#confirmLadyTarget").disabled = false;
    });
  });
  $("#confirmLadyTarget").disabled = true;
  showLadyStep("ladyPickStep");
  $("#ladyDialog").showModal();
}

function revealLady() {
  const target = state.assignments[state.ladyTarget];
  const faction = factionOf(target);
  $("#ladyResultIcon").className = `pass-icon ${faction}`;
  $("#ladyResultIcon use").setAttribute("href", `#i-${faction === "good" ? "shield" : "skull"}`);
  $("#ladyResultWho").textContent = `${target.name} 屬於`;
  const title = $("#ladyResultTitle");
  title.textContent = faction === "good" ? "忠誠陣營" : "邪惡陣營";
  title.className = `result-title ${faction}`;
  showLadyStep("ladyResultStep");
  // Same sound for both factions so bystanders can't tell the result.
  tone(560, 0.1);
  vibrate(20);
}

function finishLady() {
  if (state.ladyTarget === null) return;
  state.ladyUses.push({ quest: state.quests.length, holder: state.ladyHolder, target: state.ladyTarget });
  state.ladyHistory.push(state.ladyTarget);
  state.ladyHolder = state.ladyTarget;
  state.ladyTarget = null;
  saveGame();
  $("#ladyDialog").close();
  renderGame();
  showToast(`湖中女神交給 ${state.assignments[state.ladyHolder].name}`);
}

function requestCloseLady() {
  if ($("#ladyResultStep").classList.contains("active")) finishLady();
  else $("#ladyDialog").close();
}

function showLadyStep(id) {
  $$(".lady-step").forEach((step) => step.classList.toggle("active", step.id === id));
}

/* ---------- Assassination ---------- */
function openAssassination() {
  const assassin = state.assignments.find((player) => player.role === "assassin");
  state.assassinationTargetIndex = null;
  $("#assassinationOptions").innerHTML = state.assignments
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player !== assassin)
    .map(({ player, index }) => `
      <label class="chip danger">
        <input type="radio" name="assassination-target" value="${index}">
        <span>${escapeHtml(player.name)}</span>
      </label>
    `).join("");
  $$("#assassinationOptions input").forEach((input) => {
    input.addEventListener("change", () => {
      state.assassinationTargetIndex = Number(input.value);
      const target = state.assignments[state.assassinationTargetIndex];
      $("#confirmAssassination").textContent = `刺殺 ${target.name}`;
      $("#confirmAssassination").disabled = false;
    });
  });
  $("#confirmAssassination").textContent = "確認刺殺";
  $("#confirmAssassination").disabled = true;
  showAssassinationStep("assassinationPickStep");
  $("#assassinationDialog").showModal();
}

function confirmAssassination() {
  if (state.assassinationTargetIndex === null) return;
  const target = state.assignments[state.assassinationTargetIndex];
  const merlin = state.assignments.find((player) => player.role === "merlin");
  const hitMerlin = target === merlin;
  state.assassinationResolved = true;
  saveGame();
  $("#assassinationResultIcon").className = `pass-icon ${hitMerlin ? "evil" : "good"}`;
  $("#assassinationResultIcon use").setAttribute("href", `#i-${hitMerlin ? "sword" : "shield"}`);
  const title = $("#assassinationResultTitle");
  title.textContent = hitMerlin ? "刺殺成功，邪惡逆轉" : "刺殺失敗，正義獲勝";
  title.className = `result-title ${hitMerlin ? "evil" : "good"}`;
  $("#assassinationResultText").textContent = hitMerlin
    ? `${target.name} 正是梅林。`
    : `${target.name} 不是梅林；真正的梅林是 ${merlin.name}。`;
  showAssassinationStep("assassinationResultStep");
  renderGame();
  tone(hitMerlin ? 170 : 720, 0.16);
  vibrate(40);
}

function showAssassinationStep(id) {
  $$(".assassination-step").forEach((step) => step.classList.toggle("active", step.id === id));
}

/* ---------- Save / resume ---------- */
function saveGame() {
  storageSet(SAVE_KEY, JSON.stringify({
    playerCount: state.playerCount,
    assignments: state.assignments,
    revealIndex: state.revealIndex,
    phase: state.phase,
    quests: state.quests,
    questHistory: state.questHistory,
    leaderIndex: state.leaderIndex,
    rejectedProposals: state.rejectedProposals,
    assassinationResolved: state.assassinationResolved,
    assassinationTargetIndex: state.assassinationTargetIndex,
    ladyEnabled: state.ladyEnabled,
    ladyHolder: state.ladyHolder,
    ladyHistory: state.ladyHistory,
    ladyUses: state.ladyUses,
    lancelotEnabled: state.lancelotEnabled,
    lancelotDeck: state.lancelotDeck,
    lancelotDraws: state.lancelotDraws,
    excaliburEnabled: state.excaliburEnabled
  }));
}

function loadGame() {
  try {
    const saved = JSON.parse(storageGet(SAVE_KEY) || "null");
    if (saved && Array.isArray(saved.assignments) && saved.assignments.length && QUESTS[saved.playerCount]) {
      return {
        questHistory: [], ladyEnabled: false, ladyHolder: null, ladyHistory: [], ladyUses: [],
        lancelotEnabled: false, lancelotDeck: [], lancelotDraws: [], excaliburEnabled: false,
        ...saved
      };
    }
  } catch (_) {}
  return null;
}

function clearGame() {
  storageRemove(SAVE_KEY);
  state.phase = null;
}

function renderResumeCard() {
  const saved = loadGame();
  $("#resumeCard").classList.toggle("hidden", !saved);
  if (!saved) return;
  $("#resumeInfo").textContent = saved.phase === "reveal"
    ? `${saved.playerCount} 人局 · 抽籤中（${saved.revealIndex + 1}/${saved.playerCount}）`
    : `${saved.playerCount} 人局 · 已完成 ${saved.quests.length} 局任務`;
}

function resumeGame() {
  const saved = loadGame();
  if (!saved) return;
  Object.assign(state, saved, { revealFlipped: false, busy: false });
  if (state.phase === "reveal") {
    prepareReveal();
    showScreen("revealScreen");
  } else {
    renderGame();
    showScreen("gameScreen");
  }
}

function backToSetup(step) {
  $$("dialog[open]").forEach((dialog) => dialog.close());
  state.playerCount = loadGame()?.playerCount || state.playerCount;
  renderNames();
  updateSetup();
  syncRoleInputs();
  state.setupStep = step;
  renderSetupStep();
  renderResumeCard();
  showScreen("setupScreen");
}

function confirmNewGame() {
  if (confirm("確定要結束本局並回到設定嗎？本局紀錄將被清除。")) {
    clearGame();
    backToSetup(0);
  }
}

/* ---------- Preferences ---------- */
function toggleSound() {
  state.sound = !state.sound;
  storageSet("avalon-sound", state.sound ? "on" : "off");
  syncSoundButton();
  if (state.sound) tone(520, 0.05);
}

function syncSoundButton() {
  $("#soundToggle").setAttribute("aria-pressed", String(state.sound));
  $("#soundToggle use").setAttribute("href", state.sound ? "#i-volume" : "#i-volume-x");
}

function toggleTheme() {
  const light = document.body.classList.toggle("light-theme");
  storageSet("avalon-theme", light ? "light" : "dark");
  syncThemeButton();
}

function syncThemeButton() {
  const light = document.body.classList.contains("light-theme");
  const label = light ? "切換深色模式" : "切換淺色模式";
  $("#themeToggle").setAttribute("aria-label", label);
  $("#themeToggle").title = label;
  $("#themeToggle use").setAttribute("href", light ? "#i-moon" : "#i-sun");
  $('meta[name="theme-color"]').setAttribute("content", light ? "#eaf4fa" : "#040a14");
}

/* ---------- Utilities ---------- */
let audioContext;
function tone(frequency, duration) {
  if (!state.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = audioContext || new AudioContext();
    const context = audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (_) {}
}

function vibrate(ms) {
  if (state.sound && navigator.vibrate) navigator.vibrate(ms);
}

async function clearAppCache() {
  const button = $("#clearCache");
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    // Check the connection before removing the offline copy.
    if (location.protocol.startsWith("http")) {
      const response = await fetch(`./index.html?cache-refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok || !new URL(response.url).searchParams.has("cache-refresh")) {
        throw new Error("Unable to fetch the latest page");
      }
    }
    if (state.phase) saveGame();
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("./");
      if (registration && registration.scope === new URL("./", location.href).href) {
        await registration.unregister();
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("avalon-companion-")).map((key) => caches.delete(key)));
    }
    const url = new URL(location.href);
    url.searchParams.set("cache-refresh", Date.now());
    location.replace(url.href);
  } catch (_) {
    showToast("更新失敗，請確認網路連線後再試。遊戲紀錄仍保留。");
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function showScreen(id) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "auto" });
  $(`#${id} [tabindex="-1"]`)?.focus({ preventScroll: true });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function randomInt(max) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return random[0] % max;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

init();
