// preferences/preferences.js
const { ipcRenderer } = require("electron");

const themeSelect = document.getElementById("themeSelect");
const fontSelect  = document.getElementById("fontSelect");
const titleInput  = document.getElementById("prefTitle");
const saveBtn     = document.getElementById("savePref");

// Load existing preferences
ipcRenderer.send("load-preferences");
ipcRenderer.on("load-preferences", (e, prefs) => {
  if (prefs.theme) themeSelect.value = prefs.theme;
  if (prefs.font)  fontSelect.value  = prefs.font;
  if (prefs.title) titleInput.value  = prefs.title;
});

// Save preferences
saveBtn.addEventListener("click", () => {
  const newPrefs = {
    theme: themeSelect.value,
    font:  fontSelect.value,
    title: titleInput.value
  };
  ipcRenderer.send("save-preferences", newPrefs);
});