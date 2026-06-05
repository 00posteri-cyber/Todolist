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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

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
  pomodoros: store.get("tmc:pomodoros", []),
  habits: store.get("tmc:habits", [
    { id: uid(), name: "读论文 30 分钟", dates: [] },
    { id: uid(), name: "整理实验记录", dates: [] },
  ]),
  subscriptions: store.get("tmc:subscriptions", [
    { id: uid(), name: "ChatGPT Plus", price: 20, renewal: today() },
    { id: uid(), name: "云存储", price: 12, renewal: today() },
  ]),
  plans: store.get("tmc:plans", [
    { id: uid(), title: "复现论文 baseline", date: today(), priority: "高", done: false },
    { id: uid(), title: "整理下周阅读清单", date: today(), priority: "中", done: false },
  ]),
  planFilter: "all",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function persist() {
  store.set("tmc:pomodoros", state.pomodoros);
  store.set("tmc:habits", state.habits);
  store.set("tmc:subscriptions", state.subscriptions);
  store.set("tmc:plans", state.plans);
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
  if (value === today()) return "今天";
  return value;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
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
  $$(".mode-switch button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.mode === mode);
  });
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
  state.pomodoros.unshift({ id: uid(), date: today(), mode: state.mode, minutes: durations[state.mode] / 60 });
  state.remaining = durations[state.mode];
  state.running = false;
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
  const todaysPomodoros = state.pomodoros.filter((item) => item.date === today());
  const completedTasks = state.plans.filter((plan) => plan.date === today() && plan.done).length;
  const monthlySpend = state.subscriptions.reduce((sum, sub) => sum + Number(sub.price || 0), 0);
  const checkedToday = state.habits.filter((habit) => habit.dates.includes(today())).length;
  const focusMinutes = todaysPomodoros.reduce((sum, item) => sum + Number(item.minutes || 0), 0);

  $("#pomodoroCount").textContent = todaysPomodoros.length;
  $("#focusMinutes").textContent = focusMinutes;
  $("#todayPlanCount").textContent = completedTasks;
  $("#monthlySpend").textContent = `¥${monthlySpend}`;
  $("#streakDays").textContent = `${checkedToday}/${state.habits.length || 0}`;
}

function renderHabits() {
  const root = $("#habitList");
  if (!state.habits.length) {
    root.innerHTML = `<div class="empty">还没有专注记录。</div>`;
    return;
  }
  root.innerHTML = state.habits
    .map((habit) => {
      const checked = habit.dates.includes(today());
      return `
        <div class="item">
          <button class="check-button ${checked ? "checked" : ""}" data-habit-check="${habit.id}" aria-label="打卡">
            <i data-lucide="${checked ? "check" : "circle"}"></i>
          </button>
          <div class="item-main">
            <div class="item-title">${escapeHtml(habit.name)}</div>
            <span class="meta">累计 ${habit.dates.length} 次</span>
          </div>
          <button class="icon-button" data-habit-delete="${habit.id}" aria-label="删除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
    })
    .join("");
}

function renderSubscriptions() {
  const root = $("#subscriptionList");
  if (!state.subscriptions.length) {
    root.innerHTML = `<div class="empty">还没有订阅记录。</div>`;
    return;
  }
  root.innerHTML = state.subscriptions
    .map(
      (sub) => `
        <div class="item">
          <span class="chip">¥${Number(sub.price || 0)}/月</span>
          <div class="item-main">
            <div class="item-title">${escapeHtml(sub.name)}</div>
            <span class="meta">续费日 ${formatDateLabel(sub.renewal)}</span>
          </div>
          <button class="icon-button" data-sub-delete="${sub.id}" aria-label="删除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `,
    )
    .join("");
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
      const priorityClass = plan.priority === "高" ? "high" : plan.priority === "低" ? "low" : "";
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
          <button class="icon-button" data-plan-delete="${plan.id}" aria-label="删除">
            <i data-lucide="trash-2"></i>
          </button>
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
  $$(".app-section").forEach((section) => {
    section.classList.toggle("active-view", section.id === state.currentView);
  });
  $$(".bottom-tabs a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${state.currentView}`);
  });
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
  renderHabits();
  renderSubscriptions();
  renderPlans();
  renderNavState();
  if (window.lucide) lucide.createIcons();
}

function bindEvents() {
  $("#startPause").addEventListener("click", toggleTimer);
  $("#resetTimer").addEventListener("click", () => switchMode(state.mode));
  $("#completePomodoro").addEventListener("click", completePomodoro);

  $$(".mode-switch button").forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  $("#customTimeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    applyCustomTime($("#customMinutes").value);
  });

  $("#habitForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#habitName").value.trim();
    if (!name) return;
    state.habits.unshift({ id: uid(), name, dates: [] });
    $("#habitName").value = "";
    persist();
    render();
  });

  $("#subscriptionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#subName").value.trim();
    if (!name) return;
    state.subscriptions.unshift({
      id: uid(),
      name,
      price: Number($("#subPrice").value || 0),
      renewal: $("#subRenewal").value || today(),
    });
    event.currentTarget.reset();
    $("#subRenewal").value = today();
    persist();
    render();
  });

  $("#planForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#planTitle").value.trim();
    if (!title) return;
    state.plans.unshift({
      id: uid(),
      title,
      date: $("#planDate").value || today(),
      priority: $("#planPriority").value,
      done: false,
    });
    $("#planTitle").value = "";
    $("#planDate").value = today();
    $("#planPriority").value = "中";
    persist();
    render();
  });

  $$(".view-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.planFilter = button.dataset.filter;
      $$(".view-tabs button").forEach((item) => item.classList.toggle("selected", item === button));
      renderPlans();
      if (window.lucide) lucide.createIcons();
    });
  });

  $$(".bottom-tabs a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setView(link.getAttribute("href").replace("#", ""));
    });
  });

  document.addEventListener("click", (event) => {
    const habitCheck = event.target.closest("[data-habit-check]");
    const habitDelete = event.target.closest("[data-habit-delete]");
    const subDelete = event.target.closest("[data-sub-delete]");
    const planToggle = event.target.closest("[data-plan-toggle]");
    const planDelete = event.target.closest("[data-plan-delete]");

    if (habitCheck) {
      const habit = state.habits.find((item) => item.id === habitCheck.dataset.habitCheck);
      if (!habit) return;
      habit.dates = habit.dates.includes(today())
        ? habit.dates.filter((date) => date !== today())
        : [...habit.dates, today()];
    }

    if (habitDelete) state.habits = state.habits.filter((item) => item.id !== habitDelete.dataset.habitDelete);
    if (subDelete) state.subscriptions = state.subscriptions.filter((item) => item.id !== subDelete.dataset.subDelete);

    if (planToggle) {
      const plan = state.plans.find((item) => item.id === planToggle.dataset.planToggle);
      if (!plan) return;
      plan.done = !plan.done;
    }

    if (planDelete) state.plans = state.plans.filter((item) => item.id !== planDelete.dataset.planDelete);

    if (habitCheck || habitDelete || subDelete || planToggle || planDelete) {
      persist();
      render();
    }
  });

  window.addEventListener("hashchange", () => setView(getViewFromHash(), false));

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

$("#planDate").value = today();
$("#subRenewal").value = today();
state.currentView = getViewFromHash();
bindEvents();
render();
