// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { createObjectCsvStringifier } = require("csv-writer");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the main UI
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
            prefWindow.loadFile(
              path.join(__dirname, "preferences", "preferences.html")
            );
          },
        },
        { role: "quit" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
});

// IPC handler for CSV export (includes session title, average, fastest lap info)
ipcMain.on(
  "export-lap-times",
  async (event, lapData, startTime, sessionTitle) => {
    if (!lapData || lapData.length === 0) return;

    // Calculate average and fastest lap
    const lapLengths = lapData.map((r) => parseFloat(r.lapLength));
    const avg =
      lapLengths.reduce((sum, val) => sum + val, 0) / lapLengths.length;
    const fastest = Math.min(...lapLengths);
    const fastestIndex = lapLengths.indexOf(fastest);
    const fastestRound = lapData[fastestIndex].round;

    const avgStr = avg.toFixed(2);
    const fastestStr = fastest.toFixed(2);

    // Format filename using moment-timezone for Eastern Time
    const nyTime = moment
      .tz(startTime, "America/New_York")
      .format("YYYY-MM-DD_HH-mm-ss");
    const defaultFileName = `LapTimes_${nyTime}.csv`;

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFileName,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });
    if (!filePath) return;

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: "round", title: "Round" },
        { id: "timestamp", title: "Timestamp" },
        { id: "timeDiff", title: "Time Difference (s)" },
        { id: "lapLength", title: "Lap Length (s)" },
      ],
    });

    // Build CSV content
    let csvContent = "";
    csvContent += `Session Title: ${sessionTitle}\n`;
    csvContent += `Average Lap: ${avgStr} s\n`;
    csvContent += `Fastest Lap (Round ${fastestRound}): ${fastestStr} s\n\n`;
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
  }
);

// IPC handler for saving preferences
ipcMain.on("save-preferences", (event, preferences) => {
  const prefPath = path.join(app.getPath("userData"), "preferences.json");
  fs.writeFile(prefPath, JSON.stringify(preferences), (err) => {
    if (err) {
      dialog.showErrorBox("Preferences Error", "Failed to save preferences.");
    } else if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("preferences-updated", preferences);
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
    } catch {
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