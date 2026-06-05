const durations = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
  custom: 25 * 60,
};

const modeLabels = {
  focus: "专注时间",
  short: "短休息",
  long: "长休息",
  custom: "自定义",
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const state = {
  mode: "focus",
  remaining: durations.focus,
  running: false,
  timerId: null,
  currentView: "timer",
  chartRange: "day",
  pomodoros: store.get("tmc:pomodoros", []),
  membership: store.get("focusdog:membership", "free"),
  plans: store.get("tmc:plans", [
    { id: uid(), title: "复现论文 baseline", date: today(), priority: "高", done: false },
    { id: uid(), title: "整理下周阅读清单", date: today(), priority: "中", done: false },
  ]),
  planFilter: "all",
};

function persist() {
  store.set("tmc:pomodoros", state.pomodoros);
  store.set("tmc:plans", state.plans);
  store.set("focusdog:membership", state.membership);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateLabel(value) {
  if (!value) return "未设置日期";
  return value === today() ? "今天" : value;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesOn(date) {
  return state.pomodoros.filter((item) => item.date === date).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
}

function focusStats() {
  const todayMinutes = minutesOn(today());
  const weekMinutes = Array.from({ length: 7 }, (_, index) => minutesOn(dateOffset(index))).reduce((sum, value) => sum + value, 0);
  const totalMinutes = state.pomodoros.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  let streak = 0;
  for (let index = 0; index < 365; index += 1) {
    if (minutesOn(dateOffset(index)) > 0) streak += 1;
    else break;
  }
  return {
    todayCount: state.pomodoros.filter((item) => item.date === today()).length,
    todayMinutes,
    weekMinutes,
    totalMinutes,
    streak,
  };
}

function updateTimer() {
  $("#timeLeft").textContent = formatTime(state.remaining);
  $("#timerMode").textContent = modeLabels[state.mode];
  $("#customMinutes").value = Math.round(durations.custom / 60);
  $("#startPause").innerHTML = `<i data-lucide="${state.running ? "pause" : "play"}"></i><span>${
    state.running ? "暂停专注" : "开始专注"
  }</span>`;
  if (window.lucide) lucide.createIcons();
}

function switchMode(mode) {
  clearInterval(state.timerId);
  state.mode = mode;
  state.running = false;
  state.remaining = durations[mode];
  $$(".mode-switch button").forEach((button) => button.classList.toggle("selected", button.dataset.mode === mode));
  updateTimer();
}

function applyCustomTime(minutes) {
  const safeMinutes = Math.min(240, Math.max(1, Number(minutes) || 25));
  durations.custom = safeMinutes * 60;
  clearInterval(state.timerId);
  state.mode = "custom";
  state.running = false;
  state.remaining = durations.custom;
  $$(".mode-switch button").forEach((button) => button.classList.remove("selected"));
  updateTimer();
}

function completePomodoro() {
  state.pomodoros.unshift({
    id: uid(),
    date: today(),
    mode: state.mode,
    minutes: Math.round(durations[state.mode] / 60),
    completedAt: new Date().toISOString(),
  });
  state.running = false;
  state.remaining = durations[state.mode];
  clearInterval(state.timerId);
  persist();
  render();
}

function tick() {
  if (state.remaining <= 1) {
    completePomodoro();
    return;
  }
  state.remaining -= 1;
  updateTimer();
}

function toggleTimer() {
  state.running = !state.running;
  clearInterval(state.timerId);
  if (state.running) state.timerId = setInterval(tick, 1000);
  updateTimer();
}

function renderStats() {
  const stats = focusStats();
  const completedTasks = state.plans.filter((plan) => plan.date === today() && plan.done).length;
  $("#pomodoroCount").textContent = stats.todayCount;
  $("#focusMinutes").textContent = stats.todayMinutes;
  $("#todayPlanCount").textContent = completedTasks;
  $("#todayFocusStat").textContent = stats.todayMinutes;
  $("#weekFocusStat").textContent = stats.weekMinutes;
  $("#streakStat").textContent = stats.streak;
  $("#profileStreak").textContent = stats.streak;
  $("#profileMinutes").textContent = stats.totalMinutes;
  const exp = stats.totalMinutes % 100;
  $("#expValue").textContent = exp;
  $("#levelValue").textContent = Math.floor(stats.totalMinutes / 100) + 1;
  $("#expBar").style.width = `${exp}%`;
}

function renderChart() {
  const labels = state.chartRange === "day" ? ["一", "二", "三", "四", "五", "六", "日"] : state.chartRange === "week" ? ["W1", "W2", "W3", "W4", "W5", "W6", "W7"] : ["1", "5", "10", "15", "20", "25", "30"];
  const values = labels.map((_, index) => minutesOn(dateOffset(6 - index)));
  const max = Math.max(...values, 30);
  $("#focusChart").innerHTML = values
    .map((value, index) => {
      const height = Math.max(10, Math.round((value / max) * 100));
      return `<div class="bar"><span style="height:${height}%"></span><small>${labels[index]}</small></div>`;
    })
    .join("");
}

function renderFocusHistory() {
  const root = $("#focusHistory");
  if (!state.pomodoros.length) {
    root.innerHTML = `<div class="empty">还没有历史记录。完成一次专注后会出现在这里。</div>`;
    return;
  }
  root.innerHTML = state.pomodoros
    .slice(0, 8)
    .map((item) => `
      <div class="item">
        <span class="chip">🍅</span>
        <div class="item-main">
          <div class="item-title">${Number(item.minutes || 0)} 分钟专注</div>
          <span class="meta">${formatDateLabel(item.date)}</span>
        </div>
      </div>
    `)
    .join("");
}

function renderMembership() {
  const labels = { free: "免费版", monthly: "月会员", yearly: "年会员" };
  $("#membershipStatus").textContent = labels[state.membership] || "免费版";
  $$(".membership-card").forEach((card) => {
    const active = card.dataset.plan === state.membership;
    card.classList.toggle("active", active);
    card.querySelector("button").textContent = active ? "已选择" : card.dataset.plan === "monthly" ? "选择月会员" : "选择年会员";
  });
}

function renderPlans() {
  const root = $("#planList");
  let plans = [...state.plans].sort((a, b) => a.date.localeCompare(b.date));
  if (state.planFilter === "today") plans = plans.filter((plan) => plan.date === today() && !plan.done);
  if (state.planFilter === "done") plans = plans.filter((plan) => plan.done);
  if (!plans.length) {
    root.innerHTML = `<div class="empty">当前筛选下没有任务。</div>`;
    return;
  }
  root.innerHTML = plans
    .map((plan) => {
      const priorityClass = plan.priority === "低" ? "low" : "";
      return `
        <div class="item ${plan.done ? "done" : ""}">
          <button class="check-button ${plan.done ? "checked" : ""}" data-plan-toggle="${plan.id}" aria-label="完成任务">
            <i data-lucide="${plan.done ? "check" : "circle"}"></i>
          </button>
          <div class="item-main">
            <div class="item-title">${escapeHtml(plan.title)}</div>
            <span class="meta">${formatDateLabel(plan.date)}</span>
          </div>
          <span class="chip ${priorityClass}">${plan.priority}</span>
          <button class="icon-button" data-plan-delete="${plan.id}" aria-label="删除"><i data-lucide="trash-2"></i></button>
        </div>
      `;
    })
    .join("");
}

function getViewFromHash() {
  const view = location.hash.replace("#", "");
  return ["timer", "plans", "checkins", "subscriptions"].includes(view) ? view : "timer";
}

function renderNavState() {
  $$(".app-section").forEach((section) => section.classList.toggle("active-view", section.id === state.currentView));
  $$(".bottom-tabs a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${state.currentView}`));
}

function setView(view, shouldPush = true) {
  state.currentView = view;
  if (shouldPush && location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  renderNavState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  updateTimer();
  renderStats();
  renderChart();
  renderFocusHistory();
  renderMembership();
  renderPlans();
  renderNavState();
  if (window.lucide) lucide.createIcons();
}

function bindEvents() {
  $("#startPause").addEventListener("click", toggleTimer);
  $("#resetTimer").addEventListener("click", () => switchMode(state.mode));
  $("#completePomodoro").addEventListener("click", completePomodoro);
  $$(".mode-switch button").forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  $("#customTimeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    applyCustomTime($("#customMinutes").value);
  });
  $("#planForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#planTitle").value.trim();
    if (!title) return;
    state.plans.unshift({ id: uid(), title, date: $("#planDate").value || today(), priority: $("#planPriority").value, done: false });
    $("#planTitle").value = "";
    $("#planDate").value = today();
    $("#planPriority").value = "中";
    persist();
    render();
  });
  $$(".segmented-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.planFilter = button.dataset.filter;
      $$(".segmented-tabs button").forEach((item) => item.classList.toggle("selected", item === button));
      renderPlans();
      if (window.lucide) lucide.createIcons();
    });
  });
  $$(".chart-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.chartRange = button.dataset.chart;
      $$(".chart-tabs button").forEach((item) => item.classList.toggle("selected", item === button));
      renderChart();
    });
  });
  $$(".membership-card button").forEach((button) => {
    button.addEventListener("click", () => {
      state.membership = button.closest(".membership-card").dataset.plan;
      persist();
      renderMembership();
    });
  });
  $$(".bottom-tabs a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setView(link.getAttribute("href").replace("#", ""));
    });
  });
  $$("[data-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.jump)));
  document.addEventListener("click", (event) => {
    const planToggle = event.target.closest("[data-plan-toggle]");
    const planDelete = event.target.closest("[data-plan-delete]");
    if (planToggle) {
      const plan = state.plans.find((item) => item.id === planToggle.dataset.planToggle);
      if (!plan) return;
      plan.done = !plan.done;
    }
    if (planDelete) state.plans = state.plans.filter((item) => item.id !== planDelete.dataset.planDelete);
    if (planToggle || planDelete) {
      persist();
      render();
    }
  });
  window.addEventListener("hashchange", () => setView(getViewFromHash(), false));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

$("#planDate").value = today();
state.currentView = getViewFromHash();
bindEvents();
render();
