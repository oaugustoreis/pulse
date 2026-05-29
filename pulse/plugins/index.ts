import { pluginManager, getSafeContext } from "./plugin-manager";

export const LoggerPlugin = {
    name: "LoggerPlugin",
    afterRequest: (response: any, context: any) => {
        const { vu, iteration } = getSafeContext();
        const isError = response.status >= 400 || response.status === 0;
        const logType = isError
            ? "HTTP_REQUEST_FAILED"
            : "HTTP_REQUEST_SUCCESS";

        const logPayload = {
            action: context.label,
            type: logType,
            vu,
            iteration,
            method: context.method,
            status: response.status,
            duration_ms: Math.round(response.timings.duration * 100) / 100,
            url: context.url,
        };

        const logFormat = __ENV.LOG_FORMAT || "json-pretty";

        if (logFormat === "json") {
            const output = JSON.stringify(logPayload);
            if (isError) console.error(output);
            else console.log(output);
        } else if (logFormat === "json-pretty") {
            const output = JSON.stringify(logPayload, null, 2);
            if (isError) {
                output.split("\n").forEach((line) => console.error(line));
                console.error("Request Failed");
            } else {
                output.split("\n").forEach((line) => console.log(line));
            }
        } else if (logFormat === "simple") {
            const statusColor = isError ? "\x1b[31m" : "\x1b[32m";
            const resetColor = "\x1b[0m";
            const methodColor = "\x1b[36m";
            const grayColor = "\x1b[90m";
            const yellowColor = "\x1b[33m";
            const statusEmoji = isError ? "❌" : "✅";

            const logMsg = `[HTTP] ${statusEmoji} ${methodColor}${context.method}${resetColor} ${context.url} - Status: ${statusColor}${response.status}${resetColor} - Time: ${yellowColor}${logPayload.duration_ms}ms${resetColor} ${grayColor}(VU: ${vu}, Iter: ${iteration})${resetColor}`;

            if (isError) {
                console.error(logMsg);
            } else {
                console.log(logMsg);
            }
        }
    },
};

export const TracingPlugin = {
    name: "TracingPlugin",
    beforeRequest: (context: any) => {
        const traceId = `pulse-${Math.random().toString(36).substring(7)}`;
        context.params.headers["X-Pulse-Trace-Id"] = traceId;
    },
};

pluginManager.register(LoggerPlugin);
pluginManager.register(TracingPlugin);
