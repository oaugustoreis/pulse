export const thresholds: Record<string, string[]> = {
    http_req_duration: ["p(90)<1300", "p(95)<1600", "p(99)<2000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
};
