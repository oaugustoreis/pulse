#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const packageJson = require("../package.json");

if (fs.existsSync(".env")) {
    require("dotenv").config({ quiet: true });
}

const program = new Command();

program
    .name("pulse")
    .description("Pulse: Modular Load Testing Framework powered by k6")
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
    .description("Execute a load test scenario using k6")
    .argument("[scenario]", "Scenario name")
    .argument("[env]", "Target environment", "dev")
    .option("-v, --vus <number>", "Override Virtual Users")
    .option("-d, --duration <string>", "Override test duration")
    .allowUnknownOption()
    .action((scenario, envArg, options, command) => {
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
            execSync("node scripts/build.mjs", { stdio: "inherit" });
        } catch (error) {
            console.error(chalk.red.bold("\n✖ Build failed. Aborting k6 run."));
            process.exit(1);
        }

        let envVars = `-e SCENARIO=${finalScenario} -e ENV=${finalEnv}`;
        if (options.vus) envVars += ` -e VUS=${options.vus}`;
        if (options.duration) envVars += ` -e DURATION=${options.duration}`;

        const dotenv = require("dotenv").config();
        const envKeys = Object.keys(dotenv.parsed || {});
        envKeys.forEach((key) => {
            if (process.env[key] && key !== "SCENARIO" && key !== "ENV") {
                envVars += ` -e ${key}=${process.env[key]}`;
            }
        });

        const extraArgs = command.args
            .filter((arg) => arg !== scenario && arg !== envArg)
            .join(" ");
        let k6Args = "";
        if (options.vus) k6Args += ` --vus ${options.vus}`;
        if (options.duration) k6Args += ` --duration ${options.duration}`;
        if (extraArgs) k6Args += ` ${extraArgs}`;

        const k6Command = `k6 run --log-format raw ${envVars}${k6Args} pulse/dist/main.js`;
        console.log(
            chalk.blue.bold(
                "\n═══════════════════════════════════════════════════════\n",
            ),
        );

        try {
            execSync(k6Command, { stdio: "inherit" });
        } catch (error) {
            process.exit(error.status || 1);
        }
    });

program
    .command("mock")
    .description("Start the integrated mock server")
    .action(() => {
        console.log(chalk.green.bold("\n🚀 Starting Pulse Mock Server..."));
        try {
            execSync("node data/server.js", { stdio: "inherit" });
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
            "scripts",
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
    });

program
    .command("gen")
    .description("Generate a new load test scenario boilerplate")
    .argument("<name>", "Name of the scenario (kebab-case)")
    .action((name) => {
        const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const capitalName =
            camelName.charAt(0).toUpperCase() + camelName.slice(1);
        console.log(
            chalk.cyan(`Generating scenario boilerplate for "${name}"...`),
        );

        const ucDir = path.join("src/use-cases", name);
        fs.mkdirSync(ucDir, { recursive: true });
        fs.writeFileSync(
            path.join(ucDir, `get${capitalName}.useCase.ts`),
            `import { get } from "@pulse/http";

export interface ${capitalName}Params { baseUrl: string; token: string; }

export function get${capitalName}({ baseUrl, token }: ${capitalName}Params) {
    const url = \`\${baseUrl}/${name}\`;
    return get(url, { token }, 200, "get${capitalName}");
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
        execSync("npx electron pulse/desktop/main.js", { stdio: "inherit" });
    } catch (error) {
        console.error(chalk.red.bold("\n✖ Failed to launch desktop GUI."));
        process.exit(1);
    }
}

program
    .command("gui")
    .description("Launch the Pulse Cockpit Desktop Dashboard")
    .action(() => {
        launchGui();
    });

program
    .command("open")
    .description("Open framework components (e.g. 'gui')")
    .argument("<component>", "Component to open ('gui')")
    .action((component) => {
        if (component === "gui") {
            launchGui();
        } else {
            console.error(chalk.red.bold(`\n✖ Unknown component: ${component}`));
            process.exit(1);
        }
    });

program.parse(process.argv);
