const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync, execFileSync } = require("child_process");

let mainWindow;
let activeTestProcess = null;
let activeMockProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: "Pulse Desktop - Cockpit Load Testing Dashboard",
        backgroundColor: "#0b0f19",
    });

    mainWindow.loadFile(path.join(__dirname, "src/index.html"));

     mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
}

 ipcMain.handle("get-scenarios", async () => {
    const profilesDir = path.join(__dirname, "../../src/profiles");
    const scenarios = [];
    if (!fs.existsSync(profilesDir)) return scenarios;

    try {
        const folders = fs.readdirSync(profilesDir);
        for (const folder of folders) {
            const folderPath = path.join(profilesDir, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;

            const files = fs.readdirSync(folderPath);
            for (const file of files) {
                if (file.endsWith(".profiles.ts")) {
                    const content = fs.readFileSync(
                        path.join(folderPath, file),
                        "utf8",
                    );
                     const matches =
                        content.match(/"([^"]+)"\s*:/g) ||
                        content.match(/'([^']+)'\s*:/g);
                    if (matches) {
                        matches.forEach((m) => {
                            const name = m.replace(/["':\s]/g, "");
                            if (name !== "executor" && name !== "exec") {
                                scenarios.push({
                                    name,
                                    folder,
                                });
                            }
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error reading profiles:", e);
    }
    return scenarios;
});

 ipcMain.handle("get-env-config", async () => {
    const envPath = path.join(__dirname, "../../.env");
    if (!fs.existsSync(envPath)) return {};

    const config = {};
    try {
        const content = fs.readFileSync(envPath, "utf8");
        content.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
                const parts = trimmed.split("=");
                const key = parts[0].trim();
                const value = parts.slice(1).join("=").trim();
                config[key] = value;
            }
        });
    } catch (e) {
        console.error(e);
    }
    return config;
});

ipcMain.handle("save-env-config", async (event, config) => {
    const envPath = path.join(__dirname, "../../.env");
    try {
        let content = "";
        Object.keys(config).forEach((key) => {
            content += `${key}=${config[key]}\n`;
        });
        fs.writeFileSync(envPath, content);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

 ipcMain.handle("run-test", async (event, { scenario, env, vus, duration }) => {
    if (activeTestProcess) {
        return { success: false, error: "A test is already running." };
    }

    const args = ["pulse/cli.js", "run", scenario, env];
    if (vus) {
        args.push("-v", vus);
    }
    if (duration) {
        args.push("-d", duration);
    }

    try {
        activeTestProcess = spawn("node", args, {
            cwd: path.join(__dirname, "../.."),
            env: { ...process.env, ENV: env, SCENARIO: scenario },
        });

        activeTestProcess.stdout.on("data", (data) => {
            if (mainWindow) {
                const text = data
                    .toString()
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n");
                mainWindow.webContents.send("test-log", text);
            }
        });

        activeTestProcess.stderr.on("data", (data) => {
            if (mainWindow) {
                const text = data
                    .toString()
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n");
                mainWindow.webContents.send("test-log", text);
            }
        });

        activeTestProcess.on("close", (code) => {
            activeTestProcess = null;
            if (mainWindow) {
                mainWindow.webContents.send("test-finished", code);
            }
        });

        return { success: true };
    } catch (err) {
        activeTestProcess = null;
        return { success: false, error: err.message };
    }
});

ipcMain.handle("kill-test", async () => {
    if (activeTestProcess) {
        activeTestProcess.kill("SIGINT");
        activeTestProcess = null;
        return { success: true };
    }
    return { success: false, error: "No active test running." };
});

 ipcMain.handle("start-mock-server", async () => {
    if (activeMockProcess) {
        return { success: false, error: "Mock server already running." };
    }

    try {
        activeMockProcess = spawn("node", ["data/server.js"], {
            cwd: path.join(__dirname, "../.."),
        });

        activeMockProcess.stdout.on("data", (data) => {
            if (mainWindow) {
                mainWindow.webContents.send("mock-log", data.toString());
            }
        });

        activeMockProcess.stderr.on("data", (data) => {
            if (mainWindow) {
                mainWindow.webContents.send("mock-log", data.toString());
            }
        });

        activeMockProcess.on("close", (code) => {
            activeMockProcess = null;
            if (mainWindow) {
                mainWindow.webContents.send("mock-finished", code);
            }
        });

        return { success: true };
    } catch (err) {
        activeMockProcess = null;
        return { success: false, error: err.message };
    }
});

ipcMain.handle("stop-mock-server", async () => {
    if (activeMockProcess) {
        activeMockProcess.kill();
        activeMockProcess = null;
        return { success: true };
    }
    return { success: false, error: "Mock server is not running." };
});

ipcMain.handle("get-mock-status", async () => {
    return activeMockProcess !== null;
});

 ipcMain.handle("get-report", async () => {
    const reportPath = path.join(__dirname, "../../summary.html");
    if (fs.existsSync(reportPath)) {
        return fs.readFileSync(reportPath, "utf8");
    }
    return null;
});

 ipcMain.handle("check-k6-installation", async () => {
    try {
        const output = execFileSync("k6", ["version"]).toString();
        return { installed: true, version: output.trim() };
    } catch (e) {
        return { installed: false };
    }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (activeMockProcess) activeMockProcess.kill();
    if (activeTestProcess) activeTestProcess.kill();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
