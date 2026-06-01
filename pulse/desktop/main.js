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

ipcMain.handle("generate-scenario-from-curl", async (event, { name, parsedCurl }) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        return { success: false, error: "Invalid scenario name. Name must be in kebab-case (lowercase letters, numbers, hyphens)." };
    }

    const baseDir = path.resolve(__dirname, "../../src");
    const targetDirs = [
        path.resolve(baseDir, "schemas", name),
        path.resolve(baseDir, "use-cases", name),
        path.resolve(baseDir, "flows", name),
        path.resolve(baseDir, "profiles", name),
        path.resolve(baseDir, "scenarios", name),
    ];

    for (const targetDir of targetDirs) {
        if (!targetDir.startsWith(baseDir)) {
            return { success: false, error: "Path traversal detected." };
        }
    }

    try {
        const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const capitalName = camelName.charAt(0).toUpperCase() + camelName.slice(1);
        const method = (parsedCurl.method || "GET").toUpperCase();
        const methodName = method.toLowerCase();

        // Parse URL
        let rawUrl = parsedCurl.url || "http://localhost:3333";
        if (!rawUrl.includes("://")) {
            rawUrl = "https://" + rawUrl;
        }
        let parsedUrlObj;
        try {
            parsedUrlObj = new URL(rawUrl);
        } catch (e) {
            parsedUrlObj = {
                protocol: "https:",
                host: "api.pulse-project.com",
                pathname: "/" + name,
                search: "",
                searchParams: new URLSearchParams()
            };
        }

        const defaultBaseUrl = `${parsedUrlObj.protocol}//${parsedUrlObj.host}`;

        // Parse Headers & token
        const customHeaders = {};
        let authToken = "no-token";
        if (parsedCurl.headers) {
            Object.keys(parsedCurl.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                const value = parsedCurl.headers[key];
                if (lowerKey === "authorization") {
                    if (value.toLowerCase().startsWith("bearer ")) {
                        authToken = value.slice(7).trim();
                    } else {
                        authToken = value.trim();
                    }
                } else if (lowerKey === "content-type") {
                    // skip Content-Type as it defaults to application/json
                } else {
                    customHeaders[key] = value;
                }
            });
        }

        // Query parameters mapping
        let paramsInterfaceProps = "";
        let paramsDestructuringProps = "";
        let queryParamsStr = "";
        const queryKeys = Array.from(parsedUrlObj.searchParams.keys());
        if (queryKeys.length > 0) {
            queryKeys.forEach(key => {
                const defaultVal = parsedUrlObj.searchParams.get(key) || "";
                paramsInterfaceProps += `\n    ${key}?: string;`;
                paramsDestructuringProps += `, ${key} = "${defaultVal}"`;
            });
            const queryParts = queryKeys.map(key => `${key}=\${${key}}`).join("&");
            queryParamsStr = `?${queryParts}`;
        }

        // Request Body Handling & JSON Schema inference
        let bodyDeclaration = "";
        let bodyParamName = "";
        let schemaObj = {
            type: "object",
            required: ["id"],
            properties: {
                id: { type: "number" }
            }
        };

        if (["POST", "PUT", "PATCH"].includes(method)) {
            let reqBody = parsedCurl.body || "";
            if (reqBody) {
                try {
                    const parsedJson = JSON.parse(reqBody);
                    bodyDeclaration = `const body = ${JSON.stringify(parsedJson, null, 8).trim()};\n`;
                    bodyParamName = "body";
                    
                    // Infer a beautiful response schema based on request body structure
                    function inferSchema(val) {
                        if (val === null) return { type: "null" };
                        if (Array.isArray(val)) {
                            const itemSchema = val.length > 0 ? inferSchema(val[0]) : { type: "string" };
                            return { type: "array", items: itemSchema };
                        }
                        if (typeof val === "object") {
                            const properties = {};
                            const required = [];
                            Object.keys(val).forEach(k => {
                                properties[k] = inferSchema(val[k]);
                                required.push(k);
                            });
                            return { type: "object", required, properties };
                        }
                        if (typeof val === "number") {
                            return { type: Number.isInteger(val) ? "integer" : "number" };
                        }
                        if (typeof val === "boolean") {
                            return { type: "boolean" };
                        }
                        return { type: "string" };
                    }
                    schemaObj = inferSchema(parsedJson);
                } catch (e) {
                    bodyDeclaration = `const body = ${JSON.stringify(reqBody)};\n`;
                    bodyParamName = "body";
                }
            }
        }

        const expectedStatus = method === "POST" ? 201 : method === "DELETE" ? 204 : 200;
        const pulseMethod = methodName === "delete" ? "del" : methodName;

        // Ensure directories exist
        targetDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // 1. Schema File
        fs.writeFileSync(
            path.join(baseDir, "schemas", name, `${camelName}.schema.ts`),
            `export const ${camelName}Schema = ${JSON.stringify(schemaObj, null, 4)};\n`
        );

        // 2. Use Case File
        fs.writeFileSync(
            path.join(baseDir, "use-cases", name, `${methodName}${capitalName}.useCase.ts`),
            `import { ${pulseMethod} } from "@pulse/http";
import { ps } from "@pulse/core";
import { ${camelName}Schema } from "@src/schemas/${name}/${camelName}.schema";

export interface ${capitalName}Params {
    baseUrl: string;
    token: string;${paramsInterfaceProps}
}

export function ${pulseMethod}${capitalName}({ baseUrl, token${paramsDestructuringProps} }: ${capitalName}Params) {
    const url = \`\${baseUrl}${parsedUrlObj.pathname}${queryParamsStr}\`;
    const headers = ${JSON.stringify(customHeaders, null, 4)};

    ${bodyDeclaration.trim()}
    const res = ${pulseMethod}(url, ${bodyParamName ? bodyParamName + ', ' : ''}{ token, headers }, ${expectedStatus}, "${pulseMethod}${capitalName}");

    ps.expect(res)
        .status(${expectedStatus})
        .bodyNotEmpty()
        .responseTimeLessThan(1500)
        .jsonSchema(${camelName}Schema);

    return res;
}
`
        );

        // 3. Flow File
        fs.writeFileSync(
            path.join(baseDir, "flows", name, `${camelName}.flow.ts`),
            `import { ps } from "@pulse/core";
import { ${pulseMethod}${capitalName} } from "@src/use-cases/${name}/${methodName}${capitalName}.useCase";

export interface FlowParams { baseUrl: string; token: string; }

export function ${camelName}Flow({ baseUrl, token }: FlowParams): void {
    ps.group("${capitalName} Flow", () => {
        ${pulseMethod}${capitalName}({ baseUrl, token });
        ps.sleep(1);
    });
}
`
        );

        // 4. Profiles File
        fs.writeFileSync(
            path.join(baseDir, "profiles", name, `${camelName}.profiles.ts`),
            `import { Options } from "k6/options";

export const ${camelName}Profiles: Options["scenarios"] = {
    "${name}_smoke_test": {
        executor: "shared-iterations",
        exec: "engine",
        vus: 1,
        iterations: 1,
    },
};
`
        );

        // 5. Scenario File
        fs.writeFileSync(
            path.join(baseDir, "scenarios", name, `${camelName}.scenario.ts`),
            `import { Env } from "@pulse/config";
import { ${camelName}Flow } from "@src/flows/${name}/${camelName}.flow";

export function setup${capitalName}(): { baseUrl: string; token: string; } {
    const envSuffix = (Env.ENV || "stg").toUpperCase();
    const defaultUrl = "${defaultBaseUrl}";
    const defaultToken = "${authToken}";

    const baseUrl = Env[\`BASE_URL_\${envSuffix}\`] || Env.BASE_URL || defaultUrl;
    const token = Env[\`TOKEN_\${envSuffix}\`] || Env.TOKEN || defaultToken;

    return { baseUrl, token };
}

export function ${camelName}Scenario(data: { baseUrl: string; token: string; }): void {
    ${camelName}Flow({
        baseUrl: data.baseUrl,
        token: data.token,
    });
}
`
        );

        // 6. Thresholds File
        fs.writeFileSync(
            path.join(baseDir, "scenarios", name, "thresholds.ts"),
            `export const thresholds = {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
};
`
        );

        return { success: true, name };
    } catch (e) {
        return { success: false, error: e.message };
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
