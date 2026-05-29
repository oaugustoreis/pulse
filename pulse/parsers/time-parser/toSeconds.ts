const DURATION_METRIC_NAMES = new Set([
    "group_duration", "http_req_blocked", "http_req_duration", "http_req_waiting",
    "http_req_connecting", "http_req_tls_handshaking", "http_req_sending",
    "http_req_receiving", "iteration_duration"
]);

export function convertDurationsToSeconds(data: any): any {
    const converted = { ...data, metrics: {} };
    for (const [name, metric] of Object.entries(data.metrics || {})) {
        const isCustomMs = name.endsWith("_ms");
        const isBuiltIn = DURATION_METRIC_NAMES.has(name);
        const isDuration = isCustomMs || isBuiltIn;

        if (!isDuration) {
            converted.metrics[name] = metric;
            continue;
        }

        const values = { ...(metric.values || {}) };
        for (const key of Object.keys(values)) {
            if (typeof values[key] === "number") {
                values[key] = (values[key] as number) / 1000;
            }
        }

        const newName = isCustomMs ? name.replace(/_ms$/, "_s") : `${name} (s)`;
        converted.metrics[newName] = { ...metric, values };
    }
    return converted;
}
