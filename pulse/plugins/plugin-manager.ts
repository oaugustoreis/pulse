import { Response, RefinedParams } from "k6/http";
import { ps, PulseContext } from "../core/pulse";

export interface RequestContext {
    method: string;
    url: string;
    body: any;
    params: RefinedParams<any>;
    label: string;
}

export interface PulsePlugin {
    name: string;
    beforeScenario?: (data: any) => void;
    afterScenario?: (data: any) => void;
    beforeRequest?: (context: RequestContext) => void;
    afterRequest?: (response: Response, context: RequestContext) => void;
}

export function getSafeContext(): PulseContext {
    return ps.context();
}

class PluginManager {
    private plugins: PulsePlugin[] = [];

    register(plugin: PulsePlugin) {
        this.plugins.push(plugin);
    }

    emitBeforeScenario(data: any) {
        this.plugins.forEach(p => p.beforeScenario?.(data));
    }

    emitAfterScenario(data: any) {
        this.plugins.forEach(p => p.afterScenario?.(data));
    }

    emitBeforeRequest(context: RequestContext) {
        this.plugins.forEach(p => p.beforeRequest?.(context));
    }

    emitAfterRequest(response: Response, context: RequestContext) {
        this.plugins.forEach(p => p.afterRequest?.(response, context));
    }
}

export const pluginManager = new PluginManager();
