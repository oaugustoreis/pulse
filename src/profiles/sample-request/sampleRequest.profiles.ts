import { Options } from "k6/options";

export const sampleRequestProfiles: Options["scenarios"] = {
    "sample_request_smoke_test": {
        executor: "shared-iterations",
        exec: "engine",
        vus: 1,
        iterations: 1,
    },
};
