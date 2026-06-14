const ROLE_DATA = {
  merlin: {
    name: "梅林", faction: "good", glyph: "✦", subtitle: "知曉邪惡",
    power: "你看得見邪惡之人，但看不見莫德雷德。"
  },
  percival: {
    name: "派西維爾", faction: "good", glyph: "♢", subtitle: "守護梅林",
    power: "你看得見梅林與莫甘娜，但無法分辨兩人。"
  },
  loyal: {
    name: "亞瑟的忠臣", faction: "good", glyph: "♜", subtitle: "忠誠無畏",
    power: "你沒有額外情報。觀察言行，找出邪惡。"
  },
  assassin: {
    name: "刺客", faction: "evil", glyph: "†", subtitle: "刺殺梅林",
    power: "若正義完成三次任務，你可刺殺梅林逆轉勝局。"
  },
  morgana: {
    name: "莫甘娜", faction: "evil", glyph: "☾", subtitle: "偽裝梅林",
    power: "你會在派西維爾眼中偽裝成梅林。"
  },
  mordred: {
    name: "莫德雷德", faction: "evil", glyph: "♛", subtitle: "躲避梅林",
    power: "梅林無法看見你的邪惡身分。"
  },
  oberon: {
    name: "奧伯倫", faction: "evil", glyph: "◈", subtitle: "孤立邪惡",
    power: "你不認識其他邪惡角色，他們也看不見你。"
  },
  minion: {
    name: "莫德雷德的爪牙", faction: "evil", glyph: "♞", subtitle: "邪惡同盟",
    power: "你與其他邪惡角色合作，使任務失敗。"
  }
};

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
  "merlin", "percival", "loyal",
  "assassin", "morgana", "mordred", "oberon", "minion"
];

const state = {
  playerCount: 5,
  names: [],
  selected: new Set(["merlin", "percival", "assassin", "morgana"]),
  assignments: [],
  revealIndex: 0,
  quests: [],
  leaderIndex: 0,
  sound: true,
  questTeam: [],
  questVotes: [],
  questVoterIndex: 0,
  pendingQuestResult: null,
  rejectedProposals: 0,
  assassinationResolved: false,
  assassinationTarget: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function init() {
  const savedNames = JSON.parse(localStorage.getItem("avalon-player-names") || "[]");
  state.names = Array.from({ length: 10 }, (_, i) => savedNames[i] || `玩家 ${i + 1}`);
  const savedTheme = localStorage.getItem("avalon-theme");
  document.body.classList.toggle("light-theme", savedTheme === "light");
  renderNames();
  renderRoles();
  updateSetup();
  bindEvents();
  syncThemeButton();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  $("#decreasePlayers").addEventListener("click", () => changePlayerCount(-1));
  $("#increasePlayers").addEventListener("click", () => changePlayerCount(1));
  $("#resetRoles").addEventListener("click", applyRecommendedRoles);
  $("#startGame").addEventListener("click", startGame);
  $("#revealRole").addEventListener("click", revealCurrentRole);
  $("#hideRole").addEventListener("click", continueReveal);
  $("#previousLeader").addEventListener("click", () => changeLeader(-1));
  $("#nextLeader").addEventListener("click", () => changeLeader(1));
  $("#newGame").addEventListener("click", confirmNewGame);
  $("#showRules").addEventListener("click", () => $("#rulesDialog").showModal());
  $("#closeRules").addEventListener("click", () => $("#rulesDialog").close());
  $("#soundToggle").addEventListener("click", toggleSound);
  $("#themeToggle").addEventListener("click", toggleTheme);
  $(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    if ($("#setupScreen").classList.contains("active") || confirm("要離開目前遊戲並回到設定嗎？")) {
      showScreen("setupScreen");
    }
  });
  $("#startQuestVote").addEventListener("click", openQuestVote);
  $("#closeQuest").addEventListener("click", () => $("#questDialog").close());
  $("#confirmTeam").addEventListener("click", confirmQuestTeam);
  $$(".approval-button").forEach((button) => {
    button.addEventListener("click", () => recordProposalResult(button.dataset.proposal));
  });
  $("#openVote").addEventListener("click", showChaliceChoice);
  $$(".chalice").forEach((button) => {
    button.addEventListener("click", () => castQuestVote(button.dataset.vote));
  });
  $("#revealQuestResult").addEventListener("click", revealQuestResult);
  $("#finishQuest").addEventListener("click", finishQuestVote);
  $("#startAssassination").addEventListener("click", openAssassination);
  $("#closeAssassination").addEventListener("click", () => $("#assassinationDialog").close());
  $("#confirmAssassination").addEventListener("click", confirmAssassination);
  $("#finishAssassination").addEventListener("click", () => $("#assassinationDialog").close());
}

function changePlayerCount(delta) {
  state.playerCount = Math.max(5, Math.min(10, state.playerCount + delta));
  renderNames();
  applyRecommendedRoles();
  updateSetup();
  tone(360, 0.04);
}

function renderNames() {
  $("#nameList").innerHTML = Array.from({ length: state.playerCount }, (_, i) => `
    <label class="player-name">
      <span>${String(i + 1).padStart(2, "0")}</span>
      <input type="text" maxlength="12" value="${escapeHtml(state.names[i])}" placeholder="輸入玩家名字" aria-label="第 ${i + 1} 位玩家名稱">
    </label>
  `).join("");

  $$("#nameList input").forEach((input, index) => {
    input.addEventListener("input", () => {
      state.names[index] = input.value.trim() || `玩家 ${index + 1}`;
      localStorage.setItem("avalon-player-names", JSON.stringify(state.names));
    });
  });
}

function renderRoles() {
  const goodIds = ["merlin", "percival"];
  const evilIds = ["assassin", "morgana", "mordred", "oberon"];
  $("#goodRoles").innerHTML = goodIds.map(roleOptionTemplate).join("");
  $("#evilRoles").innerHTML = evilIds.map(roleOptionTemplate).join("");

  $$(".role-option input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selected.add(input.value);
      else state.selected.delete(input.value);
      enforceRoleDependencies(input.value);
      syncRoleInputs();
      updateRoleSummary();
    });
  });
}

function roleOptionTemplate(id) {
  const role = ROLE_DATA[id];
  return `
    <label class="role-option ${role.faction}-role">
      <input type="checkbox" value="${id}" ${state.selected.has(id) ? "checked" : ""}>
      <span class="role-glyph">${role.glyph}</span>
      <span><b>${role.name}</b><small>${role.subtitle}</small></span>
    </label>
  `;
}

function enforceRoleDependencies(changedId) {
  if (changedId === "morgana" && state.selected.has("morgana")) {
    state.selected.add("percival");
  }
  if (changedId === "percival" && !state.selected.has("percival")) {
    state.selected.delete("morgana");
  }
}

function syncRoleInputs() {
  $$(".role-option input").forEach((input) => {
    input.checked = state.selected.has(input.value);
  });
}

function applyRecommendedRoles() {
  const recommended = ["merlin", "percival", "assassin", "morgana"];
  if (state.playerCount >= 7) recommended.push("mordred");
  if (state.playerCount === 10) recommended.push("oberon");
  state.selected = new Set(recommended);
  syncRoleInputs();
  updateRoleSummary();
}

function updateSetup() {
  const [good, evil] = PLAYER_SPLIT[state.playerCount];
  $("#playerCount").textContent = state.playerCount;
  $("#playerCountLabel").textContent = state.playerCount;
  $("#goodCount").textContent = good;
  $("#evilCount").textContent = evil;
  $("#balanceFill").style.width = `${(good / state.playerCount) * 100}%`;
  $("#decreasePlayers").disabled = state.playerCount === 5;
  $("#increasePlayers").disabled = state.playerCount === 10;
  updateRoleSummary();
}

function updateRoleSummary() {
  const [goodSlots, evilSlots] = PLAYER_SPLIT[state.playerCount];
  const selectedGood = [...state.selected].filter((id) => ROLE_DATA[id].faction === "good").length;
  const selectedEvil = [...state.selected].filter((id) => ROLE_DATA[id].faction === "evil").length;
  const valid = selectedGood <= goodSlots && selectedEvil <= evilSlots;
  const summary = $("#roleSummary");
  summary.classList.toggle("error", !valid);
  summary.textContent = valid
    ? `剩餘位置將補入 ${goodSlots - selectedGood} 位忠臣、${evilSlots - selectedEvil} 位爪牙`
    : "特殊角色超過陣營人數，請取消部分角色";
  return valid;
}

function startGame() {
  if (!updateRoleSummary()) {
    $("#setupMessage").textContent = "角色配置無法容納目前的玩家人數。";
    return;
  }

  state.names = $$("#nameList input").map((input, i) => input.value.trim() || `玩家 ${i + 1}`);
  if (new Set(state.names.map((name) => name.toLowerCase())).size !== state.names.length) {
    $("#setupMessage").textContent = "玩家名稱不可重複，否則情報會難以辨識。";
    return;
  }

  $("#setupMessage").textContent = "";
  const [goodSlots, evilSlots] = PLAYER_SPLIT[state.playerCount];
  const roles = [...state.selected];
  const selectedGood = roles.filter((id) => ROLE_DATA[id].faction === "good").length;
  const selectedEvil = roles.filter((id) => ROLE_DATA[id].faction === "evil").length;

  roles.push(...Array(goodSlots - selectedGood).fill("loyal"));
  roles.push(...Array(evilSlots - selectedEvil).fill("minion"));

  const shuffledRoles = shuffle(roles);
  const orderedNames = state.names.slice(0, state.playerCount);
  state.assignments = orderedNames.map((name, index) => ({ name, role: shuffledRoles[index] }));
  state.revealIndex = 0;
  state.quests = [];
  state.leaderIndex = 0;
  state.rejectedProposals = 0;
  state.assassinationResolved = false;
  state.assassinationTarget = null;
  preparePassScreen();
  showScreen("passScreen");
  tone(520, 0.08);
}

function preparePassScreen() {
  const current = state.assignments[state.revealIndex];
  $("#turnCount").textContent = `第 ${state.revealIndex + 1} 位／共 ${state.playerCount} 位`;
  $("#currentPlayerName").textContent = current.name;
}

function revealCurrentRole() {
  const assignment = state.assignments[state.revealIndex];
  const role = ROLE_DATA[assignment.role];
  const reveal = $("#roleReveal");
  reveal.className = `role-reveal ${role.faction}`;
  $("#roleSeal").className = `seal ${role.faction}`;
  $("#roleSeal").textContent = role.glyph;
  $("#factionTitle").textContent = role.faction === "good" ? "忠誠陣營 · SERVANT OF ARTHUR" : "邪惡陣營 · MINION OF MORDRED";
  $("#revealedRole").textContent = role.name;
  $("#rolePower").textContent = role.power;
  $("#roleKnowledge").textContent = buildKnowledge(assignment);
  showScreen("roleScreen");
  tone(role.faction === "good" ? 660 : 220, 0.12);
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

  return "你只知道自己的忠誠。請從討論與投票中尋找線索。";
}

function continueReveal() {
  state.revealIndex += 1;
  if (state.revealIndex < state.assignments.length) {
    preparePassScreen();
    showScreen("passScreen");
  } else {
    renderGame();
    showScreen("gameScreen");
  }
  tone(400, 0.05);
}

function renderGame() {
  renderQuests();
  renderLeader();
  $("#miniRoles").innerHTML = state.assignments
    .map(({ role }) => role)
    .sort((a, b) => ROLE_DISPLAY_ORDER.indexOf(a) - ROLE_DISPLAY_ORDER.indexOf(b))
    .map((role) => `<span class="mini-role ${ROLE_DATA[role].faction}">${ROLE_DATA[role].name}</span>`)
    .join("");
  renderRejectionCount();
}

function renderQuests() {
  const questSizes = QUESTS[state.playerCount];
  const currentQuest = state.quests.length;
  $("#questTrack").innerHTML = questSizes.map((size, index) => {
    const result = state.quests[index];
    const needsTwoFails = state.playerCount >= 7 && index === 3;
    const symbol = result === "success" ? "♜" : result === "failure" ? "♞" : index + 1;
    return `
      <div class="quest-node ${result || ""} ${index === currentQuest ? "current" : ""}">
        <div class="quest-circle">${symbol}</div>
        <b>${size} 人出征</b>
        <small>${needsTwoFails ? "需 2 失敗" : "需 1 失敗"}</small>
      </div>
    `;
  }).join("");

  const successes = state.quests.filter((result) => result === "success").length;
  const failures = state.quests.filter((result) => result === "failure").length;
  $("#scoreText").textContent = `正義 ${successes} · 邪惡 ${failures}`;

  const gameOver = successes >= 3 || failures >= 3 || state.quests.length >= 5 || state.rejectedProposals >= 5;
  $("#startQuestVote").disabled = gameOver;
  const hasAssassinationRoles = state.assignments.some((player) => player.role === "assassin")
    && state.assignments.some((player) => player.role === "merlin");
  const awaitingAssassination = successes >= 3 && hasAssassinationRoles && !state.assassinationResolved;
  $("#startQuestVote").classList.toggle("hidden", successes >= 3);
  $("#startAssassination").classList.toggle("hidden", !awaitingAssassination);

  if (state.rejectedProposals >= 5) {
    $("#questNote").textContent = "連續五次組隊未通過，邪惡陣營獲勝。";
  } else if (state.assassinationResolved) {
    $("#questNote").textContent = state.assassinationTarget?.role === "merlin"
      ? "刺客成功刺殺梅林，邪惡陣營逆轉獲勝。"
      : "刺客未能找出梅林，正義陣營獲勝。";
  } else if (successes >= 3) {
    $("#questNote").textContent = hasAssassinationRoles
      ? "正義完成三次任務。現在由刺客指認梅林！"
      : "正義完成三次任務，本局沒有完整刺殺角色，正義陣營獲勝。";
  } else if (failures >= 3) {
    $("#questNote").textContent = "邪惡完成三次破壞，莫德雷德的勢力獲勝。";
  } else {
    const next = state.quests.length;
    const twoFails = state.playerCount >= 7 && next === 3;
    $("#questNote").textContent = `第 ${next + 1} 次任務派出 ${questSizes[next]} 人${twoFails ? "，至少兩張失敗票才會失敗" : ""}。`;
  }
}

function openQuestVote() {
  const successes = state.quests.filter((item) => item === "success").length;
  const failures = state.quests.filter((item) => item === "failure").length;
  if (state.quests.length >= 5 || successes >= 3 || failures >= 3) return;

  const required = QUESTS[state.playerCount][state.quests.length];
  state.questTeam = [];
  state.questVotes = [];
  state.questVoterIndex = 0;
  state.pendingQuestResult = null;
  $("#teamStepTitle").textContent = `選擇 ${required} 位出征隊員`;
  $("#teamOptions").innerHTML = state.assignments.map((player, index) => `
    <label class="team-option">
      <input type="checkbox" value="${index}">
      <span>${escapeHtml(player.name)}</span>
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
    ? "出征名單已完成，請先在現場舉手表決。"
    : `已選 ${checked.length} 位，還需要選擇 ${required - checked.length} 位。`;
}

function confirmQuestTeam() {
  state.questTeam = $$("#teamOptions input:checked").map((input) => state.assignments[Number(input.value)]);
  showQuestStep("approvalStep");
}

function recordProposalResult(result) {
  if (result === "approve") {
    state.rejectedProposals = 0;
    state.questVoterIndex = 0;
    renderRejectionCount();
    prepareQuestVoter();
    showQuestStep("votePassStep");
    tone(580, 0.06);
    return;
  }

  state.rejectedProposals += 1;
  tone(240, 0.06);
  changeLeader(1);
  $("#questDialog").close();
  renderRejectionCount();
  renderQuests();
  showToast(state.rejectedProposals >= 5
    ? "連續五次組隊未通過，邪惡陣營獲勝。"
    : `組隊未通過，改由 ${state.assignments[state.leaderIndex].name} 派遣任務。`);
}

function prepareQuestVoter() {
  const voter = state.questTeam[state.questVoterIndex];
  $("#voteTurnCount").textContent = `第 ${state.questVoterIndex + 1} 票／共 ${state.questTeam.length} 票`;
  $("#voterName").textContent = voter.name;
}

function showChaliceChoice() {
  const voter = state.questTeam[state.questVoterIndex];
  const isGood = ROLE_DATA[voter.role].faction === "good";
  $("#chaliceVoter").textContent = voter.name;
  $(".chalice.failure").disabled = isGood;
  $("#voteWarning").textContent = isGood ? "忠誠陣營必須選擇成功之盃。" : "邪惡陣營可以選擇成功或失敗。";
  showQuestStep("chaliceStep");
}

function castQuestVote(vote) {
  const voter = state.questTeam[state.questVoterIndex];
  if (vote === "failure" && ROLE_DATA[voter.role].faction === "good") return;
  state.questVotes.push(vote);
  state.questVoterIndex += 1;
  tone(vote === "success" ? 640 : 190, 0.08);

  if (state.questVoterIndex < state.questTeam.length) {
    prepareQuestVoter();
    showQuestStep("votePassStep");
    return;
  }
  showQuestStep("questSealedStep");
}

function revealQuestResult() {
  const failures = state.questVotes.filter((vote) => vote === "failure").length;
  const requiredFailures = state.playerCount >= 7 && state.quests.length === 3 ? 2 : 1;
  const result = failures >= requiredFailures ? "failure" : "success";
  state.pendingQuestResult = result;
  $("#resultSeal").className = `seal ${result === "success" ? "good" : "evil"}`;
  $("#resultSeal").textContent = result === "success" ? "♜" : "♞";
  $("#questResultTitle").textContent = result === "success" ? "任務成功" : "任務失敗";
  $("#resultTally").textContent = `${state.questVotes.length - failures} 張成功之盃 · ${failures} 張失敗之盃`;
  showQuestStep("questResultStep");
}

function finishQuestVote() {
  const result = state.pendingQuestResult;
  if (!result) return;
  state.quests.push(result);
  changeLeader(1);
  $("#questDialog").close();
  renderQuests();
  tone(result === "success" ? 700 : 180, 0.14);
  showToast(result === "success" ? "任務成功，正義向前一步。" : "任務遭到破壞。");
}

function openAssassination() {
  const assassin = state.assignments.find((player) => player.role === "assassin");
  state.assassinationTarget = null;
  $("#assassinationOptions").innerHTML = state.assignments
    .filter((player) => player !== assassin)
    .map((player, index) => `
      <label class="assassination-option">
        <input type="radio" name="assassination-target" value="${state.assignments.indexOf(player)}">
        <span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(player.name)}</span>
      </label>
    `).join("");
  $$("#assassinationOptions input").forEach((input) => {
    input.addEventListener("change", () => {
      state.assassinationTarget = state.assignments[Number(input.value)];
      $("#selectedTarget").textContent = `刺殺目標：${state.assassinationTarget.name}`;
      $("#confirmAssassination").disabled = false;
    });
  });
  $("#selectedTarget").textContent = "尚未選擇目標";
  $("#confirmAssassination").disabled = true;
  showAssassinationStep("assassinationPickStep");
  $("#assassinationDialog").showModal();
}

function confirmAssassination() {
  if (!state.assassinationTarget) return;
  const merlin = state.assignments.find((player) => player.role === "merlin");
  const hitMerlin = state.assassinationTarget === merlin;
  state.assassinationResolved = true;
  $("#assassinationResultSeal").className = `seal ${hitMerlin ? "evil" : "good"}`;
  $("#assassinationResultSeal").textContent = hitMerlin ? "†" : "♜";
  $("#assassinationResultTitle").textContent = hitMerlin ? "刺殺成功，邪惡逆轉" : "刺殺失敗，正義獲勝";
  $("#assassinationResultText").textContent = hitMerlin
    ? `${state.assassinationTarget.name} 正是梅林。`
    : `${state.assassinationTarget.name} 不是梅林；真正的梅林是 ${merlin?.name || "未加入本局"}。`;
  showAssassinationStep("assassinationResultStep");
  renderQuests();
  tone(hitMerlin ? 170 : 720, 0.16);
}

function showAssassinationStep(id) {
  $$(".assassination-step").forEach((step) => step.classList.toggle("active", step.id === id));
}

function showQuestStep(id) {
  $$(".quest-step").forEach((step) => step.classList.toggle("active", step.id === id));
}

function changeLeader(delta) {
  state.leaderIndex = (state.leaderIndex + delta + state.assignments.length) % state.assignments.length;
  renderLeader();
  tone(420, 0.04);
}

function renderLeader() {
  $("#leaderName").textContent = state.assignments[state.leaderIndex]?.name || state.names[0];
}

function renderRejectionCount() {
  $("#rejectionCount").textContent = `${state.rejectedProposals} / 5`;
}

function confirmNewGame() {
  if (confirm("確定要清除本局任務紀錄並回到設定嗎？")) {
    showScreen("setupScreen");
  }
}

function toggleSound() {
  state.sound = !state.sound;
  $("#soundToggle").style.opacity = state.sound ? "1" : ".4";
  $("#soundToggle").setAttribute("aria-label", state.sound ? "關閉音效" : "開啟音效");
  if (state.sound) tone(520, 0.05);
}

function toggleTheme() {
  const light = document.body.classList.toggle("light-theme");
  localStorage.setItem("avalon-theme", light ? "light" : "dark");
  syncThemeButton();
}

function syncThemeButton() {
  const light = document.body.classList.contains("light-theme");
  $("#themeToggle span").textContent = light ? "☾" : "☀";
  $("#themeToggle").setAttribute("aria-label", light ? "切換深色模式" : "切換淺色模式");
}

function tone(frequency, duration) {
  if (!state.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
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

function showScreen(id) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

init();
