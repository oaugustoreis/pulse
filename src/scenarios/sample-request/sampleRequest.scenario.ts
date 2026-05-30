import { Env, configResolver } from "@pulse/config";
import { sampleRequestFlow } from "@src/flows/sample-request/sampleRequest.flow";
import { loadCsv } from "@pulse/data/data-loader";
import { ps } from "@pulse/core";

/**
 * ============================================================================
 * PULSE SCENARIO ENTRYPOINT
 * ============================================================================
 * Scenarios are the main entrypoints for k6. Pulse automatically discovers
 * scenarios in this directory based on naming conventions.
 * 
 * Each scenario maps to a load profile (defined in src/profiles/) and handles:
 * 1. Global Setup (running once to resolve configs, tokens, or prep data).
 * 2. VU Iterations (stretching load across concurrent virtual users).
 * ============================================================================
 */

// Load CSV test data. DataLoader automatically resolves local datasets
// and provides type-safe array access for concurrent VUs.
const userDataset = loadCsv<any>(
    "sample_users", 
    "../../data/datasets/sample-request/sample-request.dataset.csv"
);

/**
 * SETUP HOOK (Runs once at the very start of the test)
 * Used to parse environment configs, authorize, or query master tokens.
 * The returned object is securely passed down as 'data' to every single VU.
 */
export function setupSampleRequest(): { baseUrl: string; token: string; debugMode: boolean } {
    const debugMode = configResolver.get("APP_DEBUG", "false") === "true";
    const envSuffix = (Env.ENV || "stg").toUpperCase();
    const baseUrl = Env[`BASE_URL_${envSuffix}`] || Env.BASE_URL || "http://localhost:3333";
    const token = Env[`TOKEN_${envSuffix}`] || Env.TOKEN || "no-token";

    return { baseUrl, token, debugMode };
}

/**
 * VU ITERATION FUNCTION (Executes concurrently inside k6 VUs)
 * This function loops repeatedly for the duration of the test.
 */
export function sampleRequestScenario(data: { baseUrl: string; token: string; debugMode: boolean }): void {
    // ps.context() gives access to current VU ID and iteration indexes.
    const { iteration } = ps.context();
    
    // Distribute/shard dataset rows evenly among concurrent iterations
    const index = iteration % userDataset.length;
    const datasetUser = userDataset[index];

    // Trigger the actual orchestrated business flow
    sampleRequestFlow({
        baseUrl: data.baseUrl,
        token: data.token,
        datasetUser: datasetUser
    });
}
