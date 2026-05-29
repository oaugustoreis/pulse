interface SummaryData {
    metrics: { [key: string]: any };
    metadata?: { scenario?: string };
    root_group: any;
}

export function generateCustomHtmlReport(data: SummaryData): string {
    const metrics = data.metrics;
    const totalRequests = metrics.http_reqs ? metrics.http_reqs.values.count : 0;
    const errorRate = metrics.http_req_failed ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : "0.00";
    const successRate = (100 - parseFloat(errorRate)).toFixed(2);
    const avgDuration = metrics.http_req_duration ? metrics.http_req_duration.values.avg.toFixed(2) : "0.00";
    const p95Duration = metrics.http_req_duration ? metrics.http_req_duration.values["p(95)"].toFixed(2) : "0.00";
    const maxVus = metrics.vus ? metrics.vus.values.max : "N/A";
    
    const scenarioName = data.metadata ? data.metadata.scenario || "Load Test" : "Load Test";
    const date = new Date().toLocaleString();

    const httpMetrics = Object.keys(metrics)
        .filter(key => key.startsWith("http_req_duration{") || key === "http_req_duration")
        .map(key => {
            const label = key.includes("expected_response") || key === "http_req_duration" 
                ? "Global" 
                : key.split("label:")[1]?.split("}")[0] || "Unknown";
            
            const m = metrics[key].values;
            const failedMetricKey = key.replace("duration", "failed");
            const count = metrics[key.replace("duration", "failed")]?.values.count || metrics.http_reqs?.values.count || 0;
            const failedRate = metrics[failedMetricKey]?.values.rate || 0;
            return {
                label,
                count,
                avg: m.avg.toFixed(2),
                p90: m["p(90)"] ? m["p(90)"].toFixed(2) : "N/A",
                p95: m["p(95)"] ? m["p(95)"].toFixed(2) : "N/A",
                p99: m["p(99)"] ? m["p(99)"].toFixed(2) : "N/A",
                failed: (failedRate * 100).toFixed(2)
            };
        })
        .filter(m => m.label !== "Global");

    const checks: any[] = [];
    function extractChecks(group: any) {
        if (group.checks) { 
            group.checks.forEach((c: any) => checks.push(c)); 
        }
        if (group.groups) { 
            group.groups.forEach(extractChecks); 
        }
    }
    extractChecks(data.root_group);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pulse Load Test Report - ${scenarioName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: rgba(22, 29, 49, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #4f46e5;
            --primary-glow: rgba(79, 70, 229, 0.3);
            --success: #10b981;
            --error: #ef4444;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            min-height: 100vh;
            padding: 2rem;
            line-height: 1.5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }

        .logo-title h1 {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .meta-info {
            text-align: right;
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .grid-kpi {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }

        .kpi-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(12px);
            transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .kpi-card:hover {
            transform: translateY(-2px);
            border-color: rgba(99, 102, 241, 0.4);
        }

        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: var(--primary);
            opacity: 0.7;
        }

        .kpi-card.success::before { background: var(--success); }
        .kpi-card.error::before { background: var(--error); }

        .kpi-card .label {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
        }

        .kpi-card .value {
            font-size: 2rem;
            font-weight: 800;
            color: var(--text-main);
        }

        .section-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .section-title::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 18px;
            background: var(--primary);
            border-radius: 2px;
        }

        .card-table-wrapper {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            backdrop-filter: blur(12px);
            margin-bottom: 2.5rem;
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }

        td {
            padding: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 0.95rem;
        }

        tr:last-child td {
            border-bottom: none;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .badge-success {
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }

        .badge-error {
            background: rgba(239, 68, 68, 0.15);
            color: var(--error);
        }

        .badge-info {
            background: rgba(79, 70, 229, 0.15);
            color: #818cf8;
        }

        .progress-bar-container {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 0.5rem;
        }

        .progress-bar-fill {
            height: 100%;
            background: var(--success);
            border-radius: 3px;
        }

        .progress-bar-fill.error {
            background: var(--error);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-title">
                <h1>PULSE FRAMEWORK</h1>
                <div style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem;">Executive Performance Summary</div>
            </div>
            <div class="meta-info">
                <div>Scenario: <strong>${scenarioName}</strong></div>
                <div>Executed at: <strong>${date}</strong></div>
            </div>
        </header>

        <div class="grid-kpi">
            <div class="kpi-card">
                <div class="label">Scenario Name</div>
                <div class="value" style="font-size: 1.1rem; font-weight: 600; margin-top: 0.7rem; word-break: break-all;">${scenarioName}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Max VUs</div>
                <div class="value">${maxVus}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Total Requests</div>
                <div class="value">${totalRequests}</div>
            </div>
            <div class="kpi-card success">
                <div class="label">Success Rate</div>
                <div class="value" style="color: var(--success);">${successRate}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${successRate}%;"></div>
                </div>
            </div>
            <div class="kpi-card error">
                <div class="label">Error Rate</div>
                <div class="value" style="color: var(--error);">${errorRate}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill error" style="width: ${errorRate}%;"></div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="label">Avg Duration</div>
                <div class="value">${avgDuration} ms</div>
            </div>
            <div class="kpi-card">
                <div class="label">P(95) Duration</div>
                <div class="value" style="color: #a5b4fc;">${p95Duration} ms</div>
            </div>
        </div>

        ${httpMetrics.length > 0 ? `
        <h2 class="section-title">HTTP Requests Metrics</h2>
        <div class="card-table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Endpoint Label</th>
                        <th>Request Count</th>
                        <th>Avg (ms)</th>
                        <th>P90 (ms)</th>
                        <th>P95 (ms)</th>
                        <th>P99 (ms)</th>
                        <th>Failure Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${httpMetrics.map(m => `
                        <tr>
                            <td><strong>${m.label}</strong></td>
                            <td>${m.count}</td>
                            <td>${m.avg}</td>
                            <td>${m.p90}</td>
                            <td>${m.p95}</td>
                            <td>${m.p99}</td>
                            <td>
                                <span class="badge ${parseFloat(m.failed) > 0 ? 'badge-error' : 'badge-success'}">
                                    ${m.failed}%
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${checks.length > 0 ? `
        <h2 class="section-title">Validation Checks</h2>
        <div class="card-table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Check Name</th>
                        <th>Successful Passes</th>
                        <th>Failures</th>
                        <th>Success Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${checks.map(c => {
                        const passRate = ((c.passes / (c.passes + c.fails)) * 100).toFixed(2);
                        return `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.passes}</td>
                            <td>${c.fails}</td>
                            <td>
                                <span class="badge ${parseFloat(passRate) >= 99 ? 'badge-success' : 'badge-error'}">
                                    ${passRate}%
                                </span>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
}
