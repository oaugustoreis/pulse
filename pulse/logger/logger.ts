import { RefinedResponse, ResponseType } from "k6/http";
import { ps } from "../core/pulse";

function getSafeContext(): { vu: number; iteration: number } {
    return ps.context();
}

export function logRequestFailure(res: RefinedResponse<ResponseType | undefined>, context: { action: string; [key: string]: any }): void {
    const { vu, iteration } = getSafeContext();
    const logPayload = {
        action: context.action,
        context,
        type: "HTTP_REQUEST_FAILED",
        vu,
        iteration,
        method: res.request.method,
        status: res.status,
        duration_ms: res.timings.duration,
        url: res.url || res.request.url || "",
    };

    const logFormat = __ENV.LOG_FORMAT || "json-pretty";

    if (logFormat === "json") {
        console.error(JSON.stringify(logPayload));
    } else if (logFormat === "json-pretty") {
        const output = JSON.stringify(logPayload, null, 2);
        output.split("\n").forEach(line => console.error(line));
        console.error("Request Failed");
    } else if (logFormat === "simple") {
        const statusColor = "\x1b[31m";
        const resetColor = "\x1b[0m";
        const methodColor = "\x1b[36m";
        const grayColor = "\x1b[90m";
        const yellowColor = "\x1b[33m";

        const logMsg = `[HTTP] ❌ ${methodColor}${logPayload.method}${resetColor} ${logPayload.url} - Status: ${statusColor}${logPayload.status}${resetColor} - Time: ${yellowColor}${Math.round(logPayload.duration_ms * 100) / 100}ms${resetColor} ${grayColor}(VU: ${vu}, Iter: ${iteration})${resetColor}`;
        console.error(logMsg);
    }
}

export function logRequestSuccess(res: RefinedResponse<ResponseType | undefined>, context: { action: string; [key: string]: any }): void {
    const { vu, iteration } = getSafeContext();
    const logPayload = {
        action: context.action,
        context,
        type: "HTTP_REQUEST_SUCCESS",
        vu,
        iteration,
        method: res.request.method,
        status: res.status,
        duration_ms: res.timings.duration,
        url: res.url || res.request.url || "",
    };

    const logFormat = __ENV.LOG_FORMAT || "json-pretty";

    if (logFormat === "json") {
        console.log(JSON.stringify(logPayload));
    } else if (logFormat === "json-pretty") {
        const output = JSON.stringify(logPayload, null, 2);
        output.split("\n").forEach(line => console.log(line));
    } else if (logFormat === "simple") {
        const statusColor = "\x1b[32m";
        const resetColor = "\x1b[0m";
        const methodColor = "\x1b[36m";
        const grayColor = "\x1b[90m";
        const yellowColor = "\x1b[33m";

        const logMsg = `[HTTP] ✅ ${methodColor}${logPayload.method}${resetColor} ${logPayload.url} - Status: ${statusColor}${logPayload.status}${resetColor} - Time: ${yellowColor}${Math.round(logPayload.duration_ms * 100) / 100}ms${resetColor} ${grayColor}(VU: ${vu}, Iter: ${iteration})${resetColor}`;
        console.log(logMsg);
    }
}
