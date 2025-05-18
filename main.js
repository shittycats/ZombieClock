// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const moment = require("moment");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadFile("index.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// ✅ Handle CSV export triggered from renderer
ipcMain.handle("reset-timer", async (event, { lapData, startTimestamp }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save Lap Times",
        defaultPath: path.join(
            app.getPath("desktop"),
            `ZombieClock_${moment(startTimestamp).format("YYYY-MM-DD_HH-mm-ss")}.csv`
        ),
        filters: [{ name: "CSV Files", extensions: ["csv"] }]
    });

    if (canceled || !filePath) return;

    const headers = ["Round", "Lap Time", "Time Diff", "Lap Length (s)"];
    const rows = lapData.map((lap, index) => [
        lap.round,
        lap.time,
        lap.timeDiff,
        lap.lapLength
    ]);

    const csvContent =
        headers.join(",") +
        "\n" +
        rows.map(row => row.join(",")).join("\n");

    fs.writeFileSync(filePath, csvContent, "utf-8");
});
