import { RawEnv } from "../../src/generated-env";

class ConfigResolver {
    get(key: string, defaultValue?: string): string {
        const value = __ENV[key];
        return value || defaultValue || "";
    }
}

export const configResolver = new ConfigResolver();
export const Env = RawEnv;
