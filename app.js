const durations = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
  custom: 25 * 60,
};

const scaleConfig = {
  min: 5,
  max: 120,
  step: 5,
  tickSpacing: 28,
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
  mascotState: null,
  theme: store.get("focusdog:theme", "light"),
  pomodoros: store.get("tmc:pomodoros", []),
  membership: store.get("focusdog:membership", "free"),
  plans: store.get("tmc:plans", [
    { id: uid(), title: "复现论文 baseline", date: today(), priority: "高", done: false },
    { id: uid(), title: "整理下周阅读清单", date: today(), priority: "中", done: false },
  ]),
  planFilter: "all",
};

const scaleState = {
  dragging: false,
  startX: 0,
  startIndex: 0,
  rawIndex: 4,
  value: 25,
};

function persist() {
  store.set("tmc:pomodoros", state.pomodoros);
  store.set("tmc:plans", state.plans);
  store.set("focusdog:membership", state.membership);
  store.set("focusdog:theme", state.theme);
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
  const mins = Math.floor(seconds / 60).toString();
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatMinutesInput(seconds) {
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapScaleMinutes(minutes) {
  const { min, max, step } = scaleConfig;
  return clamp(Math.round(minutes / step) * step, min, max);
}

function minutesToScaleIndex(minutes) {
  return (snapScaleMinutes(minutes) - scaleConfig.min) / scaleConfig.step;
}

function scaleIndexToMinutes(index) {
  return scaleConfig.min + clamp(Math.round(index), 0, (scaleConfig.max - scaleConfig.min) / scaleConfig.step) * scaleConfig.step;
}

function hapticSelection() {
  if (navigator.vibrate) navigator.vibrate(8);
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

function syncTheme() {
  document.documentElement.dataset.theme = state.theme;
  const icon = state.theme === "dark" ? "sun" : "moon";
  $("#themeToggle")?.querySelector("i")?.setAttribute("data-lucide", icon);
  $("#profileThemeToggle")?.querySelector("i")?.setAttribute("data-lucide", icon);
}

function updateTimer() {
  $("#timeLeft").textContent = formatTime(state.remaining);
  $("#timerMode").textContent = modeLabels[state.mode];
  $("#customMinutes").value = formatMinutesInput(durations.custom);
  if (!scaleState.dragging) setScaleValue(Math.round(durations[state.mode] / 60), false);
  $("#startPause").innerHTML = `<i data-lucide="${state.running ? "pause" : "play"}"></i><span>${
    state.running ? "暂停专注" : "开始专注"
  }</span>`;
  updateMascot();
  if (window.lucide) lucide.createIcons();
}

function updateMascot() {
  const mascot = $("#dogMascot");
  if (!mascot) return;
  let name = "dog_happy";
  if (state.mascotState) name = state.mascotState;
  else if (state.mode === "short" || state.mode === "long") name = "dog_sleep";
  else if (state.running) name = "dog_focus";
  mascot.src = `assets/mascot/${name}.png?v=4`;
  mascot.classList.toggle("jump", state.mascotState === "dog_celebrate");
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

function applyScaleTime(minutes, shouldHaptic = true) {
  const safeMinutes = snapScaleMinutes(Number(minutes) || 25);
  if (scaleState.value !== safeMinutes && shouldHaptic) hapticSelection();
  scaleState.value = safeMinutes;
  durations.custom = safeMinutes * 60;
  clearInterval(state.timerId);
  state.mode = "custom";
  state.running = false;
  state.remaining = durations.custom;
  $("#customMinutes").value = safeMinutes;
  $$(".mode-switch button").forEach((button) => button.classList.remove("selected"));
  updateTimer();
}

function renderTimeScale() {
  const track = $("#timeScaleTrack");
  if (!track) return;
  const totalTicks = (scaleConfig.max - scaleConfig.min) / scaleConfig.step + 1;
  track.innerHTML = Array.from({ length: totalTicks }, (_, index) => {
    const value = scaleConfig.min + index * scaleConfig.step;
    const major = value % 15 === 0 || value === scaleConfig.min || value === scaleConfig.max;
    const label = major ? `<span class="scale-tick-label">${value}</span>` : "";
    return `<span class="scale-tick ${major ? "major" : ""}" data-value="${value}">${label}</span>`;
  }).join("");
  setScaleValue(25, false);
}

function setScaleValue(minutes, shouldHaptic = false) {
  const slider = $("#timeScaleSlider");
  const track = $("#timeScaleTrack");
  if (!slider || !track) return;
  const value = snapScaleMinutes(minutes);
  if (scaleState.value !== value && shouldHaptic) hapticSelection();
  scaleState.value = value;
  scaleState.rawIndex = minutesToScaleIndex(value);
  const centerOffset = slider.clientWidth / 2 - scaleState.rawIndex * scaleConfig.tickSpacing - scaleConfig.tickSpacing / 2;
  track.style.transform = `translate3d(${centerOffset}px, 0, 0)`;
  slider.setAttribute("aria-valuenow", String(value));
  slider.setAttribute("aria-valuetext", `${value}:00`);
}

function updateScaleFromDrag(clientX, commit = false) {
  const slider = $("#timeScaleSlider");
  if (!slider) return;
  const maxIndex = (scaleConfig.max - scaleConfig.min) / scaleConfig.step;
  const delta = clientX - scaleState.startX;
  const rawIndex = clamp(scaleState.startIndex - delta / scaleConfig.tickSpacing, 0, maxIndex);
  const minutes = scaleIndexToMinutes(rawIndex);
  scaleState.rawIndex = commit ? minutesToScaleIndex(minutes) : rawIndex;
  const centerOffset = slider.clientWidth / 2 - scaleState.rawIndex * scaleConfig.tickSpacing - scaleConfig.tickSpacing / 2;
  $("#timeScaleTrack").style.transform = `translate3d(${centerOffset}px, 0, 0)`;
  if (scaleState.value !== minutes) applyScaleTime(minutes, true);
  if (commit) setScaleValue(minutes, false);
}

function startScaleDrag(event) {
  const slider = $("#timeScaleSlider");
  if (!slider) return;
  scaleState.dragging = true;
  scaleState.startX = event.clientX;
  scaleState.startIndex = scaleState.rawIndex;
  slider.classList.add("dragging");
  slider.setPointerCapture?.(event.pointerId);
}

function moveScaleDrag(event) {
  if (!scaleState.dragging) return;
  event.preventDefault();
  updateScaleFromDrag(event.clientX, false);
}

function endScaleDrag(event) {
  if (!scaleState.dragging) return;
  const slider = $("#timeScaleSlider");
  scaleState.dragging = false;
  slider?.classList.remove("dragging");
  slider?.releasePointerCapture?.(event.pointerId);
  updateScaleFromDrag(event.clientX, true);
}

function stepScale(direction) {
  applyScaleTime(scaleState.value + direction * scaleConfig.step, true);
}

function celebrate() {
  const layer = $("#rewardLayer");
  if (!layer) return;
  layer.innerHTML = Array.from({ length: 18 }, (_, index) => {
    const x = -150 + index * 18;
    const y = -150 + (index % 6) * 58;
    return `<span style="--i:${index}; --x:${x}px; --y:${y}px"></span>`;
  }).join("");
  layer.classList.add("show");
  window.setTimeout(() => {
    layer.classList.remove("show");
    layer.innerHTML = "";
  }, 1300);
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
  state.mascotState = "dog_celebrate";
  persist();
  render();
  celebrate();
  window.setTimeout(() => {
    state.mascotState = null;
    updateMascot();
  }, 1800);
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
  const exp = stats.totalMinutes % 100;
  const level = Math.floor(stats.totalMinutes / 100) + 1;

  $("#pomodoroCount").textContent = stats.todayCount;
  $("#focusMinutes").textContent = stats.todayMinutes;
  $("#todayPlanCount").textContent = completedTasks;
  $("#todayFocusStat").textContent = stats.todayMinutes;
  $("#weekFocusStat").textContent = stats.weekMinutes;
  $("#streakStat").textContent = stats.streak;
  $("#profileStreak").textContent = stats.streak;
  $("#profileMinutes").textContent = stats.totalMinutes;
  $("#expValue").textContent = exp;
  $("#levelValue").textContent = level;
  $("#growthExp").textContent = exp;
  $("#growthLevel").textContent = level;
  $("#expBar").style.width = `${exp}%`;
  $("#growthExpBar").style.width = `${exp}%`;
}

function renderChart() {
  const labels =
    state.chartRange === "day"
      ? ["一", "二", "三", "四", "五", "六", "日"]
      : state.chartRange === "week"
        ? ["W1", "W2", "W3", "W4", "W5", "W6", "W7"]
        : ["1", "5", "10", "15", "20", "25", "30"];
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
    root.innerHTML = `
      <div class="empty empty-state">
        <img src="assets/mascot/dog_empty.png?v=4" alt="朋友" />
        <span>还没有专注记录。完成一次专注后，朋友会把它收进成长小屋。</span>
      </div>
    `;
    return;
  }
  root.innerHTML = state.pomodoros
    .slice(0, 8)
    .map((item) => `
      <div class="item">
        <span class="chip tomato-chip"><i data-lucide="timer"></i></span>
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
    root.innerHTML = `
      <div class="empty empty-state">
        <img src="assets/mascot/dog_empty.png?v=4" alt="朋友" />
        <span>当前筛选下没有任务。</span>
      </div>
    `;
    return;
  }
  root.innerHTML = plans
    .map((plan) => {
      const priorityClass = plan.priority === "低" ? "low" : plan.priority === "高" ? "high" : "";
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

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  persist();
  syncTheme();
  if (window.lucide) lucide.createIcons();
}

function render() {
  syncTheme();
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
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#profileThemeToggle").addEventListener("click", toggleTheme);
  $$(".mode-switch button").forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  $("#customTimeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    applyCustomTime($("#customMinutes").value);
  });
  const scaleSlider = $("#timeScaleSlider");
  scaleSlider.addEventListener("pointerdown", startScaleDrag);
  scaleSlider.addEventListener("pointermove", moveScaleDrag);
  scaleSlider.addEventListener("pointerup", endScaleDrag);
  scaleSlider.addEventListener("pointercancel", endScaleDrag);
  scaleSlider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepScale(1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepScale(-1);
    }
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
renderTimeScale();
bindEvents();
render();
