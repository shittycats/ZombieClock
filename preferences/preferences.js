// preferences/preferences.js
const { ipcRenderer } = require("electron");

const titleInput = document.getElementById("prefTitle");
const saveButton = document.getElementById("savePref");

// Optional: Load current preferences when the window opens.
ipcRenderer.send("load-preferences");
ipcRenderer.on("load-preferences", (event, preferences) => {
  if (preferences.title) {
    titleInput.value = preferences.title;
  }
});

saveButton.addEventListener("click", () => {
  const newTitle = titleInput.value;
  ipcRenderer.send("save-preferences", { title: newTitle });
});