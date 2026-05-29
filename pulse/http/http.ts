import http, { Response, RequestBody } from "k6/http";
import { pluginManager, RequestContext } from "../plugins/plugin-manager";
import { ps } from "../core/pulse";

interface ExtendedParams {
    headers?: Record<string, string>;
    token?: string;
    tags?: Record<string, string>;
    [key: string]: any;
}

function _request(
    method: string, 
    url: string, 
    body: RequestBody | null = null, 
    params: ExtendedParams = {}, 
    expectedStatus: number | number[] = 200, 
    label: string = ""
): Response {
    const defaultHeaders: Record<string, string> = {
        "Content-Type": "application/json",
    };

    const token = params.token || __ENV.TOKEN;
    if (token && (!params.headers || !params.headers["Authorization"])) {
        defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    params.headers = { ...defaultHeaders, ...params.headers };

    const context: RequestContext = {
        method,
        url,
        body,
        params: params as any,
        label: label || method
    };

    pluginManager.emitBeforeRequest(context);

    const payload = body && typeof body === "object" ? JSON.stringify(body) : body;
    const res = http.request(method, url, payload, params as any);

    pluginManager.emitAfterRequest(res, context);

    const isExpectedStatus = Array.isArray(expectedStatus) 
        ? expectedStatus.includes(res.status) 
        : res.status === expectedStatus;

    ps.check(res, {
        [`${label || method} status is ${expectedStatus}`]: () => isExpectedStatus,
    });

    return res;
}

export function get(url: string, params: ExtendedParams = {}, expectedStatus: number | number[] = 200, label: string = "GET"): Response {
    return _request("GET", url, null, params, expectedStatus, label);
}

export function post(url: string, body: RequestBody, params: ExtendedParams = {}, expectedStatus: number | number[] = 201, label: string = "POST"): Response {
    return _request("POST", url, body, params, expectedStatus, label);
}

export function put(url: string, body: RequestBody, params: ExtendedParams = {}, expectedStatus: number | number[] = 200, label: string = "PUT"): Response {
    return _request("PUT", url, body, params, expectedStatus, label);
}

export function patch(url: string, body: RequestBody, params: ExtendedParams = {}, expectedStatus: number | number[] = 200, label: string = "PATCH"): Response {
    return _request("PATCH", url, body, params, expectedStatus, label);
}

export function del(url: string, params: ExtendedParams = {}, expectedStatus: number | number[] = 204, label: string = "DELETE"): Response {
    return _request("DELETE", url, null, params, expectedStatus, label);
}
