import { Options } from "k6/options";
import { options as baseOptions } from "../config/options";
import { convertDurationsToSeconds } from "@pulse/parsers/time-parser/toSeconds";
import { thresholds as globalThresholds } from "../config/thresholds";
import { pluginManager } from "@pulse/plugins/plugin-manager";
import { generateCustomHtmlReport } from "@pulse/reporter/customHtmlReporter";
import "@pulse/plugins/index";

import { registry } from "./virtual-registry";

const scenarioName = __ENV.SCENARIO || "";
const config = registry[scenarioName];

if (!config) {
    throw new Error(
        `\n❌ Scenario "${scenarioName}" not found in Virtual Registry.`,
    );
}

const finalThresholds = config.thresholds || globalThresholds;
const resolvedProfile = { ...config.profile };

if (__ENV.VUS) {
    resolvedProfile.vus = parseInt(__ENV.VUS, 10);
}
if (__ENV.DURATION) {
    if (
        resolvedProfile.executor &&
        resolvedProfile.executor.includes("iterations")
    ) {
        resolvedProfile.maxDuration = __ENV.DURATION;
    } else {
        resolvedProfile.duration = __ENV.DURATION;
    }
}

const finalScenarios: Options["scenarios"] = {
    [scenarioName]: resolvedProfile,
};

export const options: Options = {
    ...baseOptions,
    thresholds: finalThresholds as Options["thresholds"],
    scenarios: finalScenarios,
};

export function setup(): any {
    const setupData = config.setup ? config.setup() : {};
    pluginManager.emitBeforeScenario(setupData);
    return setupData;
}

export function engine(data: any): void {
    config.scenarioFunc(data);
}

export default engine;

export function teardown(data: any): void {
    pluginManager.emitAfterScenario(data);
}

export function handleSummary(data: any): {
    [key: string]: string | ArrayBuffer;
} {
    const dataWithSeconds = convertDurationsToSeconds(data);
    return {
        "summary.html": generateCustomHtmlReport(dataWithSeconds),
    };
}
