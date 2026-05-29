import { Env, configResolver } from "@pulse/config";
import { sampleRequestFlow } from "@src/flows/sample-request/sampleRequest.flow";
import { loadCsv } from "@pulse/data/data-loader";
import { ps } from "@pulse/core";

const userDataset = loadCsv<any>(
    "sample_users", 
    "../../data/datasets/sample-request/sample-request.dataset.csv"
);

export function setupSampleRequest(): { baseUrl: string; token: string; debugMode: boolean } {
    const debugMode = configResolver.get("APP_DEBUG", "false") === "true";
    const envSuffix = (Env.ENV || "stg").toUpperCase();
    const baseUrl = Env[`BASE_URL_${envSuffix}`] || Env.BASE_URL || "http://localhost:3333";
    const token = Env[`TOKEN_${envSuffix}`] || Env.TOKEN || "no-token";

    return { baseUrl, token, debugMode };
}

export function sampleRequestScenario(data: { baseUrl: string; token: string; debugMode: boolean }): void {
    const { iteration } = ps.context();
    const index = iteration % userDataset.length;
    const datasetUser = userDataset[index];

    sampleRequestFlow({
        baseUrl: data.baseUrl,
        token: data.token,
        datasetUser: datasetUser
    });
}
