#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync, spawn } = require("child_process");
const packageJson = require("../package.json");

if (fs.existsSync(".env")) {
    require("dotenv").config({ quiet: true });
}

function isK6Installed() {
    try {
        execSync("k6 version", { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
    }
}

function findLocalK6Path() {
    const possiblePaths = [];

    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local");
        const programData = process.env.ProgramData || "C:\\ProgramData";
        const programFiles = process.env.ProgramFiles || "C:\\Program Files";
        const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

        possiblePaths.push(
            path.join(localAppData, "Microsoft", "WinGet", "Links", "k6.exe"),
            path.join(programFiles, "k6", "k6.exe"),
            path.join(programFilesX86, "k6", "k6.exe"),
            path.join(programData, "chocolatey", "bin", "k6.exe")
        );
    } else if (process.platform === "darwin") {
        possiblePaths.push(
            "/opt/homebrew/bin/k6",
            "/usr/local/bin/k6"
        );
    } else if (process.platform === "linux") {
        possiblePaths.push(
            "/usr/bin/k6",
            "/usr/local/bin/k6",
            "/snap/bin/k6"
        );
    }

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return null;
}

function ensureK6Installed(forceExit = true) {
    if (isK6Installed() || findLocalK6Path()) {
        return true;
    }

    console.log(chalk.yellow("\n⚠️  k6 is not installed on this system."));
    console.log(chalk.cyan("Pulse is powered by k6 and requires it to run load tests."));
    console.log(chalk.cyan("Attempting to install k6 automatically...\n"));

    const platform = process.platform;

    if (platform === "win32") {
        try {
            console.log(chalk.gray("Checking for winget..."));
            execSync("winget --version", { stdio: "ignore" });
            console.log(chalk.green("Found winget! Installing k6 via winget..."));
            execSync("winget install k6 --source winget --silent --accept-package-agreements --accept-source-agreements", { stdio: "inherit" });
            console.log(chalk.green.bold("\n✔ k6 installed successfully via winget!"));
            return true;
        } catch (wingetErr) {
            console.log(chalk.yellow("winget failed or not found. Trying Chocolatey..."));
            try {
                execSync("choco --version", { stdio: "ignore" });
                console.log(chalk.green("Found Chocolatey! Installing k6 via Chocolatey..."));
                execSync("choco install k6 -y", { stdio: "inherit" });
                console.log(chalk.green.bold("\n✔ k6 installed successfully via Chocolatey!"));
                return true;
            } catch (chocoErr) {
                console.error(chalk.red.bold("\n✖ Could not automatically install k6."));
                console.log(chalk.white("Please install k6 manually on Windows using one of the following methods:"));
                console.log(chalk.cyan("  - Winget: ") + chalk.white("winget install k6"));
                console.log(chalk.cyan("  - Chocolatey: ") + chalk.white("choco install k6"));
                console.log(chalk.cyan("  - Scoop: ") + chalk.white("scoop install k6"));
                console.log(chalk.cyan("  - Direct Download: ") + chalk.white("https://dl.k6.io/msi/k6-latest-amd64.msi"));
                if (forceExit) process.exit(1);
                return false;
            }
        }
    } else if (platform === "darwin") {
        try {
            console.log(chalk.gray("Checking for Homebrew..."));
            execSync("brew --version", { stdio: "ignore" });
            console.log(chalk.green("Found Homebrew! Installing k6 via Homebrew..."));
            execSync("brew install k6", { stdio: "inherit" });
            console.log(chalk.green.bold("\n✔ k6 installed successfully via Homebrew!"));
            return true;
        } catch (brewErr) {
            console.error(chalk.red.bold("\n✖ Homebrew not found. Could not automatically install k6."));
            console.log(chalk.white("Please install k6 manually on macOS:"));
            console.log(chalk.cyan("  - Brew: ") + chalk.white("brew install k6"));
            if (forceExit) process.exit(1);
            return false;
        }
    } else if (platform === "linux") {
        console.log(chalk.gray("Checking Linux package managers..."));
        let installed = false;
        
        try {
            execSync("apt-get --version", { stdio: "ignore" });
            console.log(chalk.green("Found apt-get! Attempting to register repository and install k6..."));
            const script = `
                sudo gpg -k && \
                curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg && \
                echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && \
                sudo apt-get update && \
                sudo apt-get install k6 -y
            `;
            execSync(script, { stdio: "inherit" });
            installed = true;
        } catch (e) {
            try {
                execSync("dnf --version", { stdio: "ignore" });
                console.log(chalk.green("Found dnf! Installing k6..."));
                execSync("sudo dnf install https://dl.k6.io/rpm/repo.rpm -y && sudo dnf install k6 -y", { stdio: "inherit" });
                installed = true;
            } catch (e2) {
                try {
                    execSync("snap --version", { stdio: "ignore" });
                    console.log(chalk.green("Found snap! Installing k6..."));
                    execSync("sudo snap install k6", { stdio: "inherit" });
                    installed = true;
                } catch (e3) {
                    // Fail gracefully
                }
            }
        }

        if (installed) {
            console.log(chalk.green.bold("\n✔ k6 installed successfully!"));
            return true;
        } else {
            console.error(chalk.red.bold("\n✖ Could not automatically install k6 on Linux."));
            console.log(chalk.white("Please install k6 manually using your package manager. See official documentation:"));
            console.log(chalk.cyan("  https://grafana.com/docs/k6/latest/set-up/install-k6/#linux"));
            if (forceExit) process.exit(1);
            return false;
        }
    } else {
        console.error(chalk.red.bold(`\n✖ Unsupported platform: ${platform}.`));
        console.log(chalk.white("Please install k6 manually from:"));
        console.log(chalk.cyan("  https://grafana.com/docs/k6/latest/set-up/install-k6/"));
        if (forceExit) process.exit(1);
        return false;
    }
}

function checkDependencies() {
    if (!fs.existsSync("node_modules")) {
        console.error(chalk.red.bold("\n✖ Error: 'node_modules' folder not found."));
        console.error(chalk.yellow("It looks like you haven't installed dependencies in this workspace yet."));
        console.log(chalk.cyan("Please run 'npm install' to install dependencies before executing tests or opening the GUI.\n"));
        process.exit(1);
    }
}

const program = new Command();

program
    .name("pulse")
    .description("Pulse: Modular Load Testing Framework powered by K6")
    .version(packageJson.version)
    .addHelpText(
        "before",
        chalk.cyan.bold(`
██████╗ ██╗   ██╗██╗     ███████╗███████╗
██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
██████╔╝██║   ██║██║     ███████╗█████╗  
██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  
██║     ╚██████╔╝███████╗███████║███████║
╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝

Pulse: Performance Engineering Runtime
    `),
    );

program
    .command("run")
    .description("Execute a load test scenario using K6")
    .argument("[scenario]", "Scenario name")
    .argument("[env]", "Target environment", "dev")
    .option("-v, --vus <number>", "Override Virtual Users")
    .option("-d, --duration <string>", "Override test duration")
    .allowUnknownOption()
    .action((scenario, envArg, options, command) => {
        checkDependencies();
        const finalScenario = scenario || process.env.SCENARIO;
        const finalEnv = envArg || process.env.ENV || "dev";

        if (!finalScenario) {
            console.error(chalk.red.bold("\n✖ Error: Scenario not provided."));
            console.error(chalk.red.bold("\n✖ Note: You need to create a .env file before running the application."));
            console.log(
                chalk.yellow(
                    "Example: node cli.js run sample_request_smoke_test dev",
                ),
            );
            process.exit(1);
        }

        console.log(
            chalk.blue.bold(
                "\n═══════════════════════════════════════════════════════",
            ),
        );
        console.log(`${chalk.yellow("Scenario")}   ${finalScenario}`);
        console.log(`${chalk.yellow("Environment")} ${finalEnv}`);

        process.env.SCENARIO = finalScenario;
        process.env.ENV = finalEnv;

        try {
            console.log(chalk.gray("Building TypeScript..."));
            const localBuildScript = "pulse/build.mjs";
            const globalBuildScript = path.join(__dirname, "build.mjs");
            const buildScript = fs.existsSync(localBuildScript) ? localBuildScript : globalBuildScript;
            execFileSync("node", [buildScript], { stdio: "inherit" });
        } catch (error) {
            console.error(chalk.red.bold("\n✖ Build failed. Aborting k6 run."));
            process.exit(1);
        }

        const k6Args = ["run", "--log-format", "raw"];

        k6Args.push("-e", `SCENARIO=${finalScenario}`);
        k6Args.push("-e", `ENV=${finalEnv}`);

        if (options.vus) {
            k6Args.push("-e", `VUS=${options.vus}`);
        }
        if (options.duration) {
            k6Args.push("-e", `DURATION=${options.duration}`);
        }

        const dotenv = require("dotenv").config();
        const envKeys = Object.keys(dotenv.parsed || {});
        envKeys.forEach((key) => {
            if (process.env[key] && key !== "SCENARIO" && key !== "ENV") {
                k6Args.push("-e", `${key}=${process.env[key]}`);
            }
        });

        if (options.vus) {
            k6Args.push("--vus", options.vus);
        }
        if (options.duration) {
            k6Args.push("--duration", options.duration);
        }

        const extraArgsArray = command.args.filter(
            (arg) => arg !== scenario && arg !== envArg
        );
        k6Args.push(...extraArgsArray);

        k6Args.push("pulse/dist/main.js");

        console.log(
            chalk.blue.bold(
                "\n═══════════════════════════════════════════════════════\n",
            ),
        );

        let k6Cmd = "k6";
        if (!isK6Installed()) {
            const localK6 = findLocalK6Path();
            if (localK6) {
                k6Cmd = localK6;
            } else {
                ensureK6Installed(true);
                if (isK6Installed()) {
                    k6Cmd = "k6";
                } else {
                    const postInstallK6 = findLocalK6Path();
                    if (postInstallK6) {
                        k6Cmd = postInstallK6;
                    } else {
                        console.error(chalk.red.bold("\n✖ k6 was installed but is not yet available in the environment path."));
                        console.log(chalk.yellow("Please restart your terminal/IDE and try running the command again."));
                        process.exit(1);
                    }
                }
            }
        }

        try {
            execFileSync(k6Cmd, k6Args, { stdio: "inherit" });
        } catch (error) {
            process.exit(error.status || 1);
        }
    });

program
    .command("mock")
    .description("Start the integrated mock server")
    .action(() => {
        console.log(chalk.green.bold("\n🚀 Starting Pulse Mock Server..."));
        if (!fs.existsSync("data/server.js")) {
            console.error(chalk.red.bold("\n✖ Error: Mock server script not found at 'data/server.js'."));
            console.log(chalk.yellow("Make sure you run this command inside an initialized Pulse workspace."));
            process.exit(1);
        }
        try {
            execFileSync("node", ["data/server.js"], { stdio: "inherit" });
        } catch (error) {
            console.error(chalk.red.bold("\n✖ Failed to run Mock Server."));
            process.exit(1);
        }
    });

program
    .command("init")
    .description("Initialize the framework workspace directories and template files")
    .action(() => {
        console.log(chalk.green.bold("\nInitializing Pulse Workspace..."));
        
        const packageRoot = path.join(__dirname, "..");
        const itemsToCopy = [
            "config",
            "data",
            "pulse",
            "src",
            "tsconfig.json",
            ".env.example"
        ];

        function copyRecursiveSync(src, dest) {
            const exists = fs.existsSync(src);
            const stats = exists && fs.statSync(src);
            const isDirectory = exists && stats.isDirectory();
            if (isDirectory) {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                fs.readdirSync(src).forEach((childItemName) => {
                    copyRecursiveSync(
                        path.join(src, childItemName),
                        path.join(dest, childItemName)
                    );
                });
            } else {
                if (!fs.existsSync(dest)) {
                    fs.copyFileSync(src, dest);
                    console.log(chalk.gray(`Created: ${path.relative(process.cwd(), dest)}`));
                }
            }
        }

        itemsToCopy.forEach((item) => {
            const srcPath = path.join(packageRoot, item);
            const destPath = path.join(process.cwd(), item);
            if (fs.existsSync(srcPath)) {
                copyRecursiveSync(srcPath, destPath);
            }
        });

        const templatePkgPath = path.join(packageRoot, "template.package.json");
        const destPkgPath = path.join(process.cwd(), "package.json");
        if (fs.existsSync(templatePkgPath) && !fs.existsSync(destPkgPath)) {
            fs.copyFileSync(templatePkgPath, destPkgPath);
            console.log(chalk.gray("Created: package.json"));
        }

        console.log(
            chalk.green.bold(
                "\n✔ Workspace directory tree and template files initialized successfully!",
            ),
        );

        ensureK6Installed(false);
    });

program
    .command("gen")
    .description("Generate a new load test scenario boilerplate")
    .argument("<name>", "Name of the scenario (kebab-case)")
    .action((name) => {
        if (!fs.existsSync("tsconfig.json")) {
            console.error(chalk.red.bold("\n✖ Error: Not in an initialized Pulse workspace (missing tsconfig.json)."));
            console.log(chalk.yellow("Please run 'pulse init' first."));
            process.exit(1);
        }

        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
            console.error(
                chalk.red.bold(
                    "\n✖ Error: Invalid scenario name. Name must be in kebab-case (e.g., 'my-scenario-name') and contain only lowercase letters, numbers, and hyphens."
                )
            );
            process.exit(1);
        }

        const baseDir = path.resolve(process.cwd(), "src");
        const targetDirs = [
            path.resolve(baseDir, "schemas", name),
            path.resolve(baseDir, "use-cases", name),
            path.resolve(baseDir, "flows", name),
            path.resolve(baseDir, "profiles", name),
            path.resolve(baseDir, "scenarios", name),
        ];

        for (const targetDir of targetDirs) {
            if (!targetDir.startsWith(baseDir)) {
                console.error(chalk.red.bold("\n✖ Error: Path traversal detected."));
                process.exit(1);
            }
        }

        const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const capitalName =
            camelName.charAt(0).toUpperCase() + camelName.slice(1);
        console.log(
            chalk.cyan(`Generating scenario boilerplate for "${name}"...`),
        );

        const schemaDir = path.join("src/schemas", name);
        fs.mkdirSync(schemaDir, { recursive: true });
        fs.writeFileSync(
            path.join(schemaDir, `${camelName}.schema.ts`),
            `export const ${camelName}Schema = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "number" }
    }
};
`,
        );

        const ucDir = path.join("src/use-cases", name);
        fs.mkdirSync(ucDir, { recursive: true });
        fs.writeFileSync(
            path.join(ucDir, `get${capitalName}.useCase.ts`),
            `import { get } from "@pulse/http";
import { ps } from "@pulse/core";
import { ${camelName}Schema } from "@src/schemas/${name}/${camelName}.schema";

export interface ${capitalName}Params { baseUrl: string; token: string; }

export function get${capitalName}({ baseUrl, token }: ${capitalName}Params) {
    const url = \`\${baseUrl}/${name}\`;
    const res = get(url, { token }, 200, "get${capitalName}");

    ps.expect(res)
        .status(200)
        .bodyNotEmpty()
        .responseTimeLessThan(1000)
        .jsonSchema(${camelName}Schema);

    return res;
}
`,
        );

        const flowDir = path.join("src/flows", name);
        fs.mkdirSync(flowDir, { recursive: true });
        fs.writeFileSync(
            path.join(flowDir, `${camelName}.flow.ts`),
            `import { ps } from "@pulse/core";
import { get${capitalName} } from "@src/use-cases/${name}/get${capitalName}.useCase";

export interface FlowParams { baseUrl: string; token: string; }

export function ${camelName}Flow({ baseUrl, token }: FlowParams): void {
    ps.group("${capitalName} Flow", () => {
        get${capitalName}({ baseUrl, token });
        ps.sleep(1);
    });
}
`,
        );

        const profileDir = path.join("src/profiles", name);
        fs.mkdirSync(profileDir, { recursive: true });
        fs.writeFileSync(
            path.join(profileDir, `${camelName}.profiles.ts`),
            `import { Options } from "k6/options";

export const ${camelName}Profiles: Options["scenarios"] = {
    "${name}_smoke_test": {
        executor: "shared-iterations",
        exec: "engine",
        vus: 1,
        iterations: 1,
    },
};
`,
        );

        const scenarioDir = path.join("src/scenarios", name);
        fs.mkdirSync(scenarioDir, { recursive: true });
        fs.writeFileSync(
            path.join(scenarioDir, `${camelName}.scenario.ts`),
            `import { Env, configResolver } from "@pulse/config";
import { ${camelName}Flow } from "@src/flows/${name}/${camelName}.flow";
import { ps } from "@pulse/core";

export function setup${capitalName}(): { baseUrl: string; token: string; } {
    const envSuffix = (Env.ENV || "stg").toUpperCase();
    const baseUrl = Env[\`BASE_URL_\${envSuffix}\`] || Env.BASE_URL || "http://localhost:3333";
    const token = Env[\`TOKEN_\${envSuffix}\`] || Env.TOKEN || "no-token";

    return { baseUrl, token };
}

export function ${camelName}Scenario(data: { baseUrl: string; token: string; }): void {
    ${camelName}Flow({
        baseUrl: data.baseUrl,
        token: data.token,
    });
}
`,
        );

        fs.writeFileSync(
            path.join(scenarioDir, "thresholds.ts"),
            `export const thresholds = {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
};
`,
        );

        console.log(
            chalk.green.bold(
                `✔ Boilerplate for scenario "${name}" successfully generated!`,
            ),
        );
    });

program
    .command("add-env")
    .description("Add a key-value environment variable to .env")
    .argument("<key>", "Variable key name")
    .argument("<value>", "Variable value")
    .action((key, value) => {
        if (!fs.existsSync("tsconfig.json")) {
            console.error(chalk.red.bold("\n✖ Error: Not in an initialized Pulse workspace (missing tsconfig.json)."));
            console.log(chalk.yellow("Please run 'pulse init' first."));
            process.exit(1);
        }

        if (!/^[A-Za-z0-9_]+$/.test(key)) {
            console.error(
                chalk.red.bold(
                    "\n✖ Error: Invalid key name. Only alphanumeric characters and underscores are allowed."
                )
            );
            process.exit(1);
        }

        if (value.includes("\n") || value.includes("\r")) {
            console.error(
                chalk.red.bold(
                    "\n✖ Error: Value cannot contain newline characters."
                )
            );
            process.exit(1);
        }

        const envPath = ".env";
        let content = "";
        if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, "utf8");
        }

        const lines = content.split("\n");
        let updated = false;
        const newLines = lines.map((line) => {
            if (line.trim().startsWith(`${key}=`)) {
                updated = true;
                return `${key}=${value}`;
            }
            return line;
        });

        if (!updated) {
            newLines.push(`${key}=${value}`);
        }

        fs.writeFileSync(envPath, newLines.join("\n"));
        console.log(
            chalk.green.bold(`✔ Env var ${key} updated successfully in .env!`),
        );
    });

function findZipRecursively(dir, fileName) {
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                const found = findZipRecursively(fullPath, fileName);
                if (found) return found;
            } else if (file === fileName) {
                return fullPath;
            }
        } catch (e) {
            // Ignore stat errors
        }
    }
    return null;
}

function launchGui() {
    console.log(chalk.green.bold("\nLaunching Pulse Cockpit Desktop..."));
    const desktopPath = "pulse/desktop/main.js";
    if (!fs.existsSync(desktopPath)) {
        console.error(
            chalk.red.bold(
                `\n✖ Error: Desktop entrypoint not found at ${desktopPath}.\nMake sure you run this command inside an initialized Pulse workspace.`
            )
        );
        process.exit(1);
    }

    try {
        let electronPath;
        
        const localElectronDir = path.join(process.cwd(), "node_modules", "electron");
        const pathTxtPath = path.join(localElectronDir, "path.txt");
        const installScript = path.join(localElectronDir, "install.js");
        
        // Self-heal: If local electron package is installed but binary was never fully downloaded/extracted
        if (fs.existsSync(localElectronDir) && !fs.existsSync(pathTxtPath)) {
            console.log(chalk.yellow("Local Electron binary is missing (corrupted installation)."));
            console.log(chalk.cyan("Running Electron's local installation script..."));
            try {
                if (fs.existsSync(installScript)) {
                    execFileSync("node", [installScript], { stdio: "inherit" });
                }
            } catch (installErr) {
                console.warn(chalk.yellow("⚠️ Warning: Local Electron install script failed to execute."));
            }

            // Check if path.txt is STILL missing (Node's extract-zip fails silently on Windows with Node v26)
            if (!fs.existsSync(pathTxtPath) && process.platform === "win32") {
                console.log(chalk.yellow("Windows Node extract-zip bug detected. Running robust PowerShell extraction..."));
                try {
                    let electronVersion = "42.3.0";
                    const pkgJsonPath = path.join(localElectronDir, "package.json");
                    if (fs.existsSync(pkgJsonPath)) {
                        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
                        electronVersion = pkg.version;
                    }

                    const zipName = `electron-v${electronVersion}-win32-x64.zip`;
                    const cacheDir = path.join(process.env.LOCALAPPDATA || "", "electron", "Cache");
                    
                    // Search recursively for the cached zip (as newer @electron/get shards it in subdirectories)
                    const zipPath = findZipRecursively(cacheDir, zipName);
                    const distPath = path.join(localElectronDir, "dist");

                    if (zipPath && fs.existsSync(zipPath)) {
                        console.log(chalk.cyan(`Found cached zip recursively at: ${zipPath}`));
                        console.log(chalk.cyan("Extracting using PowerShell..."));
                        
                        if (!fs.existsSync(distPath)) {
                            fs.mkdirSync(distPath, { recursive: true });
                        }

                        const psCmd = `Expand-Archive -Path '${zipPath}' -DestinationPath '${distPath}' -Force`;
                        execFileSync("powershell.exe", ["-Command", psCmd], { stdio: "inherit" });
                        
                        // Write path.txt
                        fs.writeFileSync(path.join(localElectronDir, "path.txt"), "electron.exe");
                        
                        // Move electron.d.ts if it exists
                        const srcTypeDefPath = path.join(distPath, "electron.d.ts");
                        const targetTypeDefPath = path.join(localElectronDir, "electron.d.ts");
                        if (fs.existsSync(srcTypeDefPath)) {
                            fs.renameSync(srcTypeDefPath, targetTypeDefPath);
                        }
                        
                        console.log(chalk.green("✔ Electron binary extracted and configured successfully via PowerShell!"));
                    } else {
                        console.error(chalk.red(`✖ Cached zip not found recursively in: ${cacheDir} for name: ${zipName}`));
                    }
                } catch (peErr) {
                    console.error(chalk.red(`✖ PowerShell extraction failed: ${peErr.message}`));
                }
            }
        }
        
        // 1. Try to read from node_modules/electron/path.txt to resolve the local binary directly
        if (fs.existsSync(pathTxtPath)) {
            try {
                const relativeBinPath = fs.readFileSync(pathTxtPath, "utf8").trim();
                const resolvedPath = path.join(localElectronDir, "dist", relativeBinPath);
                if (fs.existsSync(resolvedPath)) {
                    electronPath = resolvedPath;
                }
            } catch (e) {
                // Fail silently and fall back
            }
        }

        // 2. Fallbacks
        if (!electronPath) {
            try {
                // Try requiring local electron package (which returns the binary path)
                electronPath = require(path.join(process.cwd(), "node_modules", "electron"));
            } catch (e) {
                try {
                    electronPath = require("electron");
                } catch (e2) {
                    // 3. Ultimate fallback: run npx electron with shell option on Windows to avoid EINVAL
                    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
                    execFileSync(npxCmd, ["electron", desktopPath], { 
                        stdio: "inherit", 
                        shell: process.platform === "win32" 
                    });
                    return;
                }
            }
        }

        execFileSync(electronPath, [desktopPath], { stdio: "inherit" });
    } catch (error) {
        console.error(chalk.red.bold("\n✖ Failed to launch desktop GUI."));
        
        const isElectronBug = error.message && (
            error.message.includes("ENOENT") || 
            error.message.includes("path.txt") ||
            error.message.includes("electron")
        );

        if (isElectronBug || !fs.existsSync(path.join(process.cwd(), "node_modules", "electron", "path.txt"))) {
            console.log(chalk.yellow("\n⚠️  Detectamos que a instalação do Electron na sua máquina está incompleta ou corrompida."));
            console.log(chalk.white("Isso é um problema comum no Windows (geralmente causado por bloqueios de antivírus ou falhas de rede durante o 'npm install')."));
            console.log(chalk.cyan("\nComo corrigir esse problema de forma fácil:"));
            console.log(chalk.white("\n👉 Opção 1 (Recomendada): Reinstalação Limpa"));
            console.log(chalk.gray("   1. Delete a pasta 'node_modules' do projeto (certifique-se de fechar editores de código para liberar travas do Windows)."));
            console.log(chalk.gray("   2. Execute 'npm install' novamente para reinstalar todas as dependências de forma limpa."));
            
            console.log(chalk.white("\n👉 Opção 2 (Segura & Limpa): Instalação Global"));
            console.log(chalk.gray("   1. Instale o Electron de forma global no seu Windows: ") + chalk.cyan("npm install -g electron"));
            console.log(chalk.gray("   2. Abra a interface chamando o motor global diretamente: ") + chalk.cyan("electron pulse/desktop/main.js"));
            
            console.log(chalk.white("\n👉 Opção 3 (Override Oficial do Electron):"));
            console.log(chalk.gray("   1. Baixe o arquivo 'electron-v42.3.0-win32-x64.zip' da página de Releases oficiais do Electron no GitHub."));
            console.log(chalk.gray("   2. Descompacte o conteúdo em uma pasta (ex: 'C:\\Electron')."));
            console.log(chalk.gray("   3. Defina a variável de ambiente no seu terminal antes de rodar: ") + chalk.cyan("$env:ELECTRON_OVERRIDE_DIST_PATH=\"C:\\Electron\"\n"));
        } else {
            if (error.message) {
                console.error(chalk.red(`Details: ${error.message}`));
            }
            if (error.stderr) {
                console.error(chalk.red(`Error Output:\n${error.stderr.toString()}`));
            }
        }
        process.exit(1);
    }
}

program
    .command("gui")
    .description("Launch the Pulse Cockpit Dashboard")
    .action(() => {
        checkDependencies();
        launchGui();
    });

program
    .command("open")
    .description("Open framework components (e.g. 'gui')")
    .argument("<component>", "Component to open ('gui')")
    .action((component) => {
        if (component === "gui") {
            checkDependencies();
            launchGui();
        } else {
            console.error(chalk.red.bold(`\n✖ Unknown component: ${component}`));
            process.exit(1);
        }
    });

program.parse(process.argv);

