// renderer/timer.js
const { ipcRenderer } = require("electron");

let startTime, elapsedTime = 0, timerInterval, running = false;
let lapDurations = [];
let lapStartTime = 0;
let roundCounter = 1;
let allLaps = [];

/**
 * Auto-resize the title textarea based on its content.
 */
function autoResizeTextArea() {
  const textArea = document.getElementById("titleInput");
  textArea.style.height = "auto"; // Reset height for shrinking
  textArea.style.height = textArea.scrollHeight + "px";
}

// Set up auto-resize for the title input
const titleInput = document.getElementById("titleInput");
titleInput.addEventListener("input", autoResizeTextArea);
autoResizeTextArea(); // Initial call

// If user presses Enter or Escape in the title input, blur it so that clock actions can resume
titleInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "Escape") {
    titleInput.blur();
  }
});

/**
 * Formats the elapsed time.
 * Displays hours only if elapsed time is over an hour.
 */
function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:` +
           `${minutes.toString().padStart(2, '0')}:` +
           `${seconds.toString().padStart(2, '0')}.` +
           `${milliseconds.toString().padStart(3, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:` +
           `${seconds.toString().padStart(2, '0')}.` +
           `${milliseconds.toString().padStart(3, '0')}`;
  }
}

function updateTimer() {
  elapsedTime = Date.now() - startTime;
  document.getElementById("timer").innerText = formatTime(elapsedTime);
}

function startStopTimer() {
  if (running) {
    clearInterval(timerInterval);
    running = false;
  } else {
    startTime = Date.now() - elapsedTime;
    lapStartTime = startTime;
    timerInterval = setInterval(updateTimer, 10);
    running = true;
  }
}

function resetTimer() {
  if (allLaps.length > 0) {
    // Send the export command with lap data, start time, and current session title
    ipcRenderer.send("export-lap-times", allLaps, startTime, titleInput.value);
  }
  clearInterval(timerInterval);
  elapsedTime = 0;
  document.getElementById("timer").innerText = "00:00.000";
  document.getElementById("laps").innerHTML = "";
  lapDurations = [];
  allLaps = [];
  roundCounter = 1;
  running = false;
}

function recordLap() {
  if (!running) return;

  const currentLapEndTime = Date.now();
  const lapDuration = currentLapEndTime - lapStartTime;
  lapStartTime = currentLapEndTime;

  const lapLengthSec = (lapDuration / 1000).toFixed(2);
  let lapClass = "";
  let diffText = "";
  let diffSec = 0;

  if (lapDurations.length > 0) {
    const previousLapDuration = lapDurations[lapDurations.length - 1];
    const lapDifference = lapDuration - previousLapDuration;
    diffSec = (lapDifference / 1000).toFixed(2);
    const sign = lapDifference < 0 ? "-" : "+";
    diffText = `(${sign}${Math.abs(diffSec)}s)`;
    lapClass = lapDifference < 0 ? "fast-lap" : "slow-lap";
  }

  lapDurations.push(lapDuration);

  allLaps.push({
    round: roundCounter,
    timestamp: formatTime(elapsedTime),
    timeDiff: diffSec,
    lapLength: lapLengthSec
  });

  const lapElement = document.createElement("div");
  lapElement.innerHTML = `<strong>Round ${roundCounter}:</strong> ${formatTime(elapsedTime)} ${diffText} [Lap length: ${lapLengthSec}s]`;
  if (lapClass) {
    lapElement.classList.add(lapClass);
  }

  const lapsContainer = document.getElementById("laps");
  lapsContainer.prepend(lapElement);

  // Keep only the last 3 laps displayed
  while (lapsContainer.children.length > 3) {
    lapsContainer.removeChild(lapsContainer.lastChild);
  }

  roundCounter++;
}

// Global keydown listener for clock actions
document.addEventListener("keydown", (event) => {
  // Disable clock actions if the title input is focused
  if (document.activeElement && document.activeElement.id === "titleInput") {
    return;
  }
  
  if (event.code === "Space") {
    startStopTimer();
  } else if (event.code === "KeyR") {
    resetTimer();
  } else {
    recordLap();
  }
});

// Initially load preferences and set the title input's value
ipcRenderer.send("load-preferences");
ipcRenderer.on("load-preferences", (event, preferences) => {
  if (preferences.title) {
    titleInput.value = preferences.title;
    autoResizeTextArea();
  }
});

// Listen for updates from the preferences window so the title updates immediately
ipcRenderer.on("preferences-updated", (event, preferences) => {
  if (preferences.title) {
    titleInput.value = preferences.title;
    autoResizeTextArea();
  }
});

console.log("🚀 Timer script loaded successfully!");