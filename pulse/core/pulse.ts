import { group as k6Group, sleep as k6Sleep, check as k6Check } from "k6";
import execution from "k6/execution";

export interface PulseContext {
    vu: number;
    iteration: number;
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
}

export const ps = new PulseCore();
