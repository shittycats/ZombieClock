// renderer/timer.js
const { ipcRenderer } = require("electron");

// DOM elements
const titleInput = document.getElementById("titleInput");
const overlay    = document.getElementById("shortcutOverlay");
const timerEl    = document.getElementById("timer");
const lapsEl     = document.getElementById("laps");
const bestLapEl  = document.getElementById("bestLap");
const avgLapEl   = document.getElementById("avgLap");
const totalEl    = document.getElementById("totalTime");

let startTime, elapsedTime = 0, timerInterval;
let running = false, paused = false, pauseStart = 0;
let lapDurations = [], lapStartTime = 0, roundCounter = 1, allLaps = [];

/** Auto-resize the title textarea based on its content. */
function autoResizeTextArea() {
  titleInput.style.height = "auto";
  titleInput.style.height = titleInput.scrollHeight + "px";
}
titleInput.addEventListener("input", autoResizeTextArea);
autoResizeTextArea();
titleInput.addEventListener("keydown", e => {
  if (e.code === "Enter" || e.code === "Escape") titleInput.blur();
});

/** Format ms into hh:mm:ss.mmm or mm:ss.mmm */
function formatTime(ms) {
  const h = Math.floor(ms/3600000),
        m = Math.floor((ms%3600000)/60000),
        s = Math.floor((ms%60000)/1000),
        msr = ms%1000;
  if (h > 0) {
    return `${h.toString().padStart(2,'0')}:` +
           `${m.toString().padStart(2,'0')}:` +
           `${s.toString().padStart(2,'0')}.` +
           `${msr.toString().padStart(3,'0')}`;
  }
  return `${m.toString().padStart(2,'0')}:` +
         `${s.toString().padStart(2,'0')}.` +
         `${msr.toString().padStart(3,'0')}`;
}

/** Update the on-screen timer. */
function updateTimer() {
  elapsedTime = Date.now() - startTime;
  timerEl.innerText = formatTime(elapsedTime);
}

/** Start/Stop the timer (Space). */
function startStopTimer() {
  if (running) {
    clearInterval(timerInterval);
    running = false;
  } else {
    startTime = Date.now() - elapsedTime;
    lapStartTime = startTime;
    timerInterval = setInterval(updateTimer, 10);
    running = true;
    paused = false;
  }
  timerEl.classList.add("scaled");
  setTimeout(() => timerEl.classList.remove("scaled"), 300);
}

/** Pause/Resume the timer (P). */
function pauseTimer() {
  if (!running) return;
  if (!paused) {
    clearInterval(timerInterval);
    paused = true;
    pauseStart = Date.now();
  } else {
    const pd = Date.now() - pauseStart;
    startTime += pd;
    lapStartTime += pd;
    timerInterval = setInterval(updateTimer, 10);
    paused = false;
  }
}

/** Reset & export laps (R). */
function resetTimer() {
  if (allLaps.length) {
    ipcRenderer.send("export-lap-times", allLaps, startTime, titleInput.value);
  }
  clearInterval(timerInterval);
  elapsedTime = 0;
  timerEl.innerText = "00:00.000";
  lapsEl.innerHTML = "";
  lapDurations = [];
  allLaps = [];
  roundCounter = 1;
  running = paused = false;
  updateStats();
}

/** Record a lap (any other key). */
function recordLap() {
  if (!running || paused) return;

  const now = Date.now();
  const ld  = now - lapStartTime;
  lapStartTime = now;

  const secs = (ld / 1000).toFixed(2);
  let cls = "", diff = "", dsec = 0;
  if (lapDurations.length) {
    const prev = lapDurations[lapDurations.length - 1];
    const delta = ld - prev;
    dsec = (delta / 1000).toFixed(2);
    const sign = delta < 0 ? "-" : "+";
    diff = `(${sign}${Math.abs(dsec)}s)`;
    cls = delta < 0 ? "fast-lap" : "slow-lap";
  }

  lapDurations.push(ld);
  allLaps.push({
    round: roundCounter,
    timestamp: formatTime(elapsedTime),
    timeDiff: dsec,
    lapLength: secs
  });

  const el = document.createElement("div");
  el.classList.add("lap-entry");
  if (cls) {
    el.classList.add(cls);
  }
  el.innerHTML = `<strong>Round ${roundCounter}:</strong> ${formatTime(elapsedTime)} ${diff} [${secs}s]`;

  lapsEl.prepend(el);
  while (lapsEl.children.length > 3) {
    lapsEl.removeChild(lapsEl.lastChild);
  }

  timerEl.classList.add("pulse");
  setTimeout(() => timerEl.classList.remove("pulse"), 400);

  roundCounter++;
  updateStats();
}

/** Update stats: fastest lap, average lap, total time. */
function updateStats() {
  if (!lapDurations.length) {
    bestLapEl.innerText = "Fastest Lap: --";
    avgLapEl.innerText  = "Average Lap: -- s";
    totalEl.innerText   = "Total Time: --";
    return;
  }

  // Find fastest lap object
  let fastest = allLaps[0];
  for (const lap of allLaps) {
    if (parseFloat(lap.lapLength) < parseFloat(fastest.lapLength)) {
      fastest = lap;
    }
  }
  const bestRound = fastest.round;
  const bestTime  = parseFloat(fastest.lapLength).toFixed(2);

  // Calculate average
  const avg = lapDurations.reduce((sum, val) => sum + val, 0) / lapDurations.length;

  bestLapEl.innerText = `Fastest Lap (Round ${bestRound}): ${bestTime} s`;
  avgLapEl.innerText  = `Average Lap: ${(avg / 1000).toFixed(2)} s`;
  totalEl.innerText   = `Total Time: ${formatTime(elapsedTime)}`;
}

/** Toggle shortcut overlay. */
document.addEventListener("keydown", e => {
  if (e.code === "Slash") overlay.classList.toggle("active");
  else if (e.code === "Escape" && overlay.classList.contains("active")) {
    overlay.classList.remove("active");
  }
});

/** Global key handler for Space/P/R and laps on keydown. */
document.addEventListener("keydown", e => {
  if (document.activeElement === titleInput) return;

  switch (e.code) {
    case "KeyP":
      pauseTimer();
      break;
    case "Space":
      startStopTimer();
      break;
    case "KeyR":
      resetTimer();
      break;
    default:
      recordLap();
  }
});

/** Apply preferences: theme, font, title. */
function applyPrefs(p) {
  if (p.theme) {
    document.body.classList.toggle("dark",  p.theme === "dark");
    document.body.classList.toggle("light", p.theme === "light");
  }
  if (p.font) {
    document.documentElement.style.setProperty("--current-font", p.font);
  }
  if (p.title) {
    titleInput.value = p.title;
    autoResizeTextArea();
  }
}

// Load & listen for preference changes
ipcRenderer.send("load-preferences");
ipcRenderer.on("load-preferences",      (e, prefs) => applyPrefs(prefs));
ipcRenderer.on("preferences-updated",   (e, prefs) => applyPrefs(prefs));

console.log("🚀 Timer script loaded successfully!");