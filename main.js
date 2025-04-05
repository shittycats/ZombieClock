// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
// Require moment-timezone instead of plain moment.
const moment = require("moment-timezone");
const { createObjectCsvStringifier } = require("csv-writer");

let mainWindow;

app.whenReady().then(() => {
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the main HTML file from the renderer folder
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Build and set the application menu (includes Preferences)
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "Preferences",
          click: () => {
            const prefWindow = new BrowserWindow({
              width: 400,
              height: 300,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
              },
            });
            prefWindow.loadFile(path.join(__dirname, "preferences", "preferences.html"));
          },
        },
        { role: "quit" },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

// Updated IPC handler for CSV export (session title in header only)
// Use moment-timezone to format the file name in Eastern Time (EST or EDT)
ipcMain.on("export-lap-times", async (event, lapData, startTime, sessionTitle) => {
  if (!lapData || lapData.length === 0) return;

  // Format file name using moment-timezone to convert startTime to Eastern Time.
  const nyTime = moment.tz(startTime, "America/New_York").format("YYYY-MM-DD_HH-mm-ss");
  const defaultFileName = `LapTimes_${nyTime}.csv`;

  // Let the user choose where to save the file
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFileName,
    filters: [{ name: "CSV Files", extensions: ["csv"] }],
  });

  if (!filePath) return; // User cancelled

  // Use csv-stringifier to generate CSV content as a string
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: "round", title: "Round" },
      { id: "timestamp", title: "Timestamp" },
      { id: "timeDiff", title: "Time Difference (s)" },
      { id: "lapLength", title: "Lap Length (s)" },
    ],
  });

  // Build CSV content:
  // 1. First line: session title.
  // 2. A blank line.
  // 3. The CSV header.
  // 4. The lap records.
  let csvContent = "";
  csvContent += "Session Title: " + sessionTitle + "\n\n";
  csvContent += csvStringifier.getHeaderString();
  csvContent += csvStringifier.stringifyRecords(lapData);

  fs.writeFile(filePath, csvContent, (err) => {
    if (err) {
      dialog.showErrorBox("Export Error", "Failed to save lap times.");
      console.error(err);
    } else {
      console.log(`✅ Lap times saved to ${filePath}`);
    }
  });
});

// IPC handler for saving preferences
ipcMain.on("save-preferences", (event, preferences) => {
  const prefPath = path.join(app.getPath("userData"), "preferences.json");
  fs.writeFile(prefPath, JSON.stringify(preferences), (err) => {
    if (err) {
      dialog.showErrorBox("Preferences Error", "Failed to save preferences.");
    } else {
      // Broadcast updated preferences to the main window so it updates immediately.
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("preferences-updated", preferences);
      }
    }
  });
});

// IPC handler for loading preferences
ipcMain.on("load-preferences", (event) => {
  const prefPath = path.join(app.getPath("userData"), "preferences.json");
  fs.readFile(prefPath, "utf8", (err, data) => {
    if (err) {
      event.sender.send("load-preferences", {});
      return;
    }
    try {
      const prefs = JSON.parse(data);
      event.sender.send("load-preferences", prefs);
    } catch (parseError) {
      event.sender.send("load-preferences", {});
    }
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});