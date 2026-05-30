import { group as k6Group, sleep as k6Sleep, check as k6Check } from "k6";
import execution from "k6/execution";

export interface PulseContext {
    vu: number;
    iteration: number;
}

function validateSchema(data: any, schema: any): boolean {
    if (!schema) return true;

    if (schema.type) {
        if (schema.type === "object") {
            if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
            
            if (schema.required && Array.isArray(schema.required)) {
                for (const req of schema.required) {
                    if (!(req in data)) return false;
                }
            }
            
            if (schema.properties) {
                for (const prop in schema.properties) {
                    if (prop in data) {
                        if (!validateSchema(data[prop], schema.properties[prop])) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        if (schema.type === "array") {
            if (!Array.isArray(data)) return false;
            
            if (schema.items) {
                for (const item of data) {
                    if (!validateSchema(item, schema.items)) return false;
                }
            }
            return true;
        }

        if (schema.type === "string") return typeof data === "string";
        if (schema.type === "number") return typeof data === "number";
        if (schema.type === "boolean") return typeof data === "boolean";
        if (schema.type === "integer") return Number.isInteger(data);
    }
    return true;
}

export class ResponseExpectation {
    private res: any;

    constructor(res: any) {
        this.res = res;
    }

    status(code: number): this {
        k6Check(this.res, {
            [`Status is ${code}`]: () => this.res.status === code,
        });
        return this;
    }

    bodyNotEmpty(): this {
        k6Check(this.res, {
            "Body is not empty": () => !!this.res.body && this.res.body.length > 0,
        });
        return this;
    }

    header(name: string, expectedValue: string): this {
        const headerName = name.toLowerCase();
        k6Check(this.res, {
            [`Header '${name}' is '${expectedValue}'`]: () => {
                const headers = this.res.headers || {};
                const actualValue = headers[name] || headers[headerName];
                return actualValue && actualValue.toLowerCase().includes(expectedValue.toLowerCase());
            }
        });
        return this;
    }

    hasProperty(path: string): this {
        k6Check(this.res, {
            [`Has property '${path}'`]: () => {
                try {
                    if (!this.res.body) return false;
                    return this.res.json(path) !== undefined;
                } catch (e) {
                    return false;
                }
            }
        });
        return this;
    }

    responseTimeLessThan(ms: number): this {
        k6Check(this.res, {
            [`Response time is less than ${ms}ms`]: () => this.res.timings.duration < ms,
        });
        return this;
    }

    jsonSchema(schema: any): this {
        k6Check(this.res, {
            "Response matches JSON schema": () => {
                try {
                    if (!this.res.body) return false;
                    const data = this.res.json();
                    return validateSchema(data, schema);
                } catch (e) {
                    return false;
                }
            }
        });
        return this;
    }
}

class PulseCore {
    group(name: string, fn: () => void): void {
        k6Group(name, fn);
    }

    sleep(seconds: number): void {
        k6Sleep(seconds);
    }

    check(val: any, sets: Record<string, () => boolean>): boolean {
        return k6Check(val, sets);
    }

    context(): PulseContext {
        let vu = 0;
        let iteration = 0;
        try { if (execution.vu) vu = execution.vu.idInTest; } catch (e) {}
        try { if (execution.scenario) iteration = execution.scenario.iterationInTest; } catch (e) {}
        return { vu, iteration };
    }

    expect(res: any): ResponseExpectation {
        return new ResponseExpectation(res);
    }
}

export const ps = new PulseCore();
