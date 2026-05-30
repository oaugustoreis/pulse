import fs from "fs";
import path from "path";
import esbuild from "esbuild";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateEnvTypes() {
    const envPath = path.join(__dirname, "../.env");
    if (!fs.existsSync(envPath)) return "";

    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    const keys = Object.keys(envConfig);

    let content = `// AUTO-GENERATED ENV TYPES - DO NOT EDIT\n`;
    content += `export interface GeneratedEnv {\n`;
    keys.forEach((key) => {
        content += `    ${key}: string;\n`;
    });
    content += `    [key: string]: string | undefined;\n`;
    content += `}\n\n`;

    content += `export const RawEnv = {\n`;
    keys.forEach((key) => {
        content += `    ${key}: __ENV.${key},\n`;
    });
    content += `} as GeneratedEnv;\n`;

    return content;
}

function findModuleForScenario(targetScenario) {
    const profilesDir = path.join(__dirname, "../src/profiles");
    if (!fs.existsSync(profilesDir)) return null;

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
                if (
                    content.includes(`"${targetScenario}"`) ||
                    content.includes(`'${targetScenario}'`) ||
                    content.includes(`${targetScenario}:`)
                ) {
                    return folder;
                }
            }
        }
    }
    return null;
}

function discoverScenarios() {
    const scenariosDir = path.join(__dirname, "../src/scenarios");
    if (!fs.existsSync(scenariosDir)) return "";

    let modules = [];
    const walk = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else if (file.endsWith(".scenario.ts")) {
                const kebabName = path.basename(dir);
                const camelName = kebabName.replace(/-([a-z])/g, (g) =>
                    g[1].toUpperCase(),
                );
                modules.push({
                    name: camelName,
                    kebab: kebabName,
                    path: fullPath,
                });
            }
        }
    };

    walk(scenariosDir);

    const targetScenario = process.env.SCENARIO;
    if (targetScenario) {
        const matchedModule = findModuleForScenario(targetScenario);
        if (matchedModule) {
            modules = modules.filter((m) => m.kebab === matchedModule);
        }
    }

    let imports = `// AUTO-GENERATED FILE - DO NOT EDIT\n`;
    let registryEntries = `export const registry: any = {\n`;

    modules.forEach((mod) => {
        const relativePath = path
            .relative(path.join(__dirname, "../pulse"), mod.path)
            .replace(/\\/g, "/")
            .replace(".ts", "");
        const profilePath = relativePath
            .replace("scenarios", "profiles")
            .replace(".scenario", ".profiles");
        const thresholdsPath = path.join(
            __dirname,
            "../src/scenarios",
            mod.kebab,
            "thresholds.ts",
        );
        const hasCustomThresholds = fs.existsSync(thresholdsPath);

        imports += `import * as ${mod.name}Scenario from '${relativePath}';\n`;
        imports += `import { ${mod.name}Profiles } from '${profilePath}';\n`;
        if (hasCustomThresholds) {
            imports += `import { thresholds as ${mod.name}Thresholds } from '../src/scenarios/${mod.kebab}/thresholds';\n`;
        }

        registryEntries += `    ...Object.keys(${mod.name}Profiles || {}).reduce((acc: any, key) => {\n`;
        registryEntries += `        acc[key] = {\n`;
        registryEntries += `            profile: (${mod.name}Profiles as any)[key],\n`;
        registryEntries += `            setup: ${mod.name}Scenario.setup${mod.name.charAt(0).toUpperCase() + mod.name.slice(1)},\n`;
        registryEntries += `            scenarioFunc: ${mod.name}Scenario.${mod.name}Scenario,\n`;
        registryEntries += `            thresholds: ${hasCustomThresholds ? `${mod.name}Thresholds` : "null"},\n`;
        registryEntries += `        };\n`;
        registryEntries += `        return acc;\n`;
        registryEntries += `    }, {}),\n`;
    });

    registryEntries += `};\n`;
    return imports + "\n" + registryEntries;
}

async function build() {
    console.log("Starting Pulse Auto-Discovery...");

    const virtualRegistry = discoverScenarios();
    fs.writeFileSync(
        path.join(__dirname, "../pulse/virtual-registry.ts"),
        virtualRegistry,
    );

    const envTypes = generateEnvTypes();
    fs.writeFileSync(path.join(__dirname, "../pulse/generated-env.ts"), envTypes);

    console.log("Building framework bundle...");
    try {
        await esbuild.build({
            entryPoints: [path.join(__dirname, "../src/main.ts")],
            bundle: true,
            minify: false,
            format: "esm",
            platform: "browser",
            target: "esnext",
            outfile: path.join(__dirname, "../pulse/dist/main.js"),
            external: ["k6", "k6/*"],
        });
        console.log("Build successful: pulse/dist/main.js");
    } catch (err) {
        console.error("Build failed:", err);
        process.exit(1);
    }
}

build();
