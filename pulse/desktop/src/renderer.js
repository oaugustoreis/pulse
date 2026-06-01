if (!window.electronAPI) {
    const listeners = {
        "test-log": [],
        "test-finished": [],
        "mock-log": [],
        "mock-finished": []
    };

    let testLogSource = null;
    let mockLogSource = null;

    function setupTestStreams() {
        if (testLogSource) return;
        testLogSource = new EventSource("/api/test-stream");
        testLogSource.addEventListener("log", (e) => {
            const chunk = JSON.parse(e.data);
            listeners["test-log"].forEach(cb => cb(chunk));
        });
        testLogSource.addEventListener("finished", (e) => {
            const code = JSON.parse(e.data);
            listeners["test-finished"].forEach(cb => cb(code));
            testLogSource.close();
            testLogSource = null;
        });
        testLogSource.onerror = () => {
            testLogSource.close();
            testLogSource = null;
        };
    }

    function setupMockStreams() {
        if (mockLogSource) return;
        mockLogSource = new EventSource("/api/mock-stream");
        mockLogSource.addEventListener("log", (e) => {
            const chunk = JSON.parse(e.data);
            listeners["mock-log"].forEach(cb => cb(chunk));
        });
        mockLogSource.addEventListener("finished", (e) => {
            const code = JSON.parse(e.data);
            listeners["mock-finished"].forEach(cb => cb(code));
            mockLogSource.close();
            mockLogSource = null;
        });
        mockLogSource.onerror = () => {
            mockLogSource.close();
            mockLogSource = null;
        };
    }

    window.electronAPI = {
        getScenarios: () => fetch("/api/scenarios").then(r => r.json()),
        getEnvConfig: () => fetch("/api/env-config").then(r => r.json()),
        saveEnvConfig: (config) => fetch("/api/save-env-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config)
        }).then(r => r.json()),
        runTest: (params) => {
            setupTestStreams();
            return fetch("/api/run-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params)
            }).then(r => r.json());
        },
        killTest: () => fetch("/api/kill-test", { method: "POST" }).then(r => r.json()),
        getReport: () => fetch("/api/get-report").then(r => r.json()),
        checkK6: () => fetch("/api/check-k6").then(r => r.json()),
        startMockServer: () => {
            setupMockStreams();
            return fetch("/api/start-mock-server", { method: "POST" }).then(r => r.json());
        },
        stopMockServer: () => fetch("/api/stop-mock-server", { method: "POST" }).then(r => r.json()),
        getMockStatus: () => fetch("/api/get-mock-status").then(r => r.json()),
        
        onTestLog: (callback) => {
            listeners["test-log"].push(callback);
            setupTestStreams();
            return () => {
                listeners["test-log"] = listeners["test-log"].filter(cb => cb !== callback);
            };
        },
        onTestFinished: (callback) => {
            listeners["test-finished"].push(callback);
            setupTestStreams();
            return () => {
                listeners["test-finished"] = listeners["test-finished"].filter(cb => cb !== callback);
            };
        },
        onMockLog: (callback) => {
            listeners["mock-log"].push(callback);
            setupMockStreams();
            return () => {
                listeners["mock-log"] = listeners["mock-log"].filter(cb => cb !== callback);
            };
        },
        onMockFinished: (callback) => {
            listeners["mock-finished"].push(callback);
            setupMockStreams();
            return () => {
                listeners["mock-finished"] = listeners["mock-finished"].filter(cb => cb !== callback);
            };
        }
    };
}

const navButtons = document.querySelectorAll(".nav-btn");
const tabContents = document.querySelectorAll(".tab-content");

function switchTab(targetTab) {
    navButtons.forEach((b) => {
        if (b.getAttribute("data-tab") === targetTab) {
            b.classList.add("active");
        } else {
            b.classList.remove("active");
        }
    });

    tabContents.forEach((tab) => {
        if (tab.id === `tab-${targetTab}`) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });
}

function showToast(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "✨";
    if (type === "success") icon = "✔";
    else if (type === "error") icon = "✖";
    else if (type === "info") icon = "ℹ";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger reflow to apply transition CSS
    toast.offsetHeight;

    toast.classList.add("show");

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }
    }, 5000);
}

navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        switchTab(targetTab);
    });
});

let isTestRunning = false;
let isMockRunning = false;
let testDurationTimer = null;
let testSeconds = 0;
let k6RawLogTextBuffer = "Waiting for load test dispatch...\n";

const selectScenario = document.getElementById("select-scenario");
const selectEnv = document.getElementById("select-env");
const btnLaunchTest = document.getElementById("btn-launch-test");
const btnAbortTest = document.getElementById("btn-abort-test");
const testStatusBadge = document.getElementById("test-status-badge");
const testTimer = document.getElementById("test-timer");
const progressRing = document.getElementById("progress-ring");
const activeScenarioName = document.getElementById("active-scenario-name");
const activeEnvName = document.getElementById("active-env-name");
const executionProgressBar = document.getElementById("execution-progress-bar");

const k6Terminal = document.getElementById("k6-terminal");
const mockTerminal = document.getElementById("mock-terminal");
const btnClearK6Logs = document.getElementById("btn-clear-k6-logs");
const btnClearMockLogs = document.getElementById("btn-clear-mock-logs");
const k6SearchInput = document.getElementById("k6-search-input");
const k6SearchCounter = document.getElementById("k6-search-counter");
const k6SearchPrev = document.getElementById("k6-search-prev");
const k6SearchNext = document.getElementById("k6-search-next");

const reportIframe = document.getElementById("report-iframe");
const reportPlaceholder = document.getElementById("report-placeholder");
const btnReloadReport = document.getElementById("btn-reload-report");

const btnStartMock = document.getElementById("btn-start-mock");
const btnStopMock = document.getElementById("btn-stop-mock");
const mockBigIndicator = document.getElementById("mock-big-indicator");
const mockStatusDot = document.getElementById("mock-status-dot");
const mockStatusText = document.getElementById("mock-status-text");
const mockActivityFeed = document.getElementById("mock-activity-feed");

const envVariablesList = document.getElementById("env-variables-list");
const btnSaveEnv = document.getElementById("btn-save-env");
const btnAddEnvRow = document.getElementById("btn-add-env-row");

async function checkK6() {
    const k6Dot = document.getElementById("k6-status-dot");
    const k6Text = document.getElementById("k6-status-text");
    try {
        const res = await window.electronAPI.checkK6();
        if (res.installed) {
            k6Dot.className = "status-dot green";
            k6Text.innerText =
                "k6: " + res.version.split(" ")[1] || "Installed";
        } else {
            k6Dot.className = "status-dot red";
            k6Text.innerText = "k6: Not Found";
        }
    } catch (e) {
        k6Dot.className = "status-dot red";
        k6Text.innerText = "k6: Check Error";
    }
}

async function loadScenarios() {
    try {
        const scenarios = await window.electronAPI.getScenarios();
        selectScenario.innerHTML = "";
        if (scenarios.length === 0) {
            selectScenario.innerHTML =
                '<option value="" disabled>No scenarios found. Use "ps gen" to create one.</option>';
            return;
        }

        const groups = {};
        scenarios.forEach((sc) => {
            if (!groups[sc.folder]) {
                groups[sc.folder] = [];
            }
            groups[sc.folder].push(sc);
        });

        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        placeholderOption.innerText = "-- Select a Scenario Profile --";
        selectScenario.appendChild(placeholderOption);

        Object.keys(groups).forEach((folder) => {
            const optgroup = document.createElement("optgroup");
            const prettyLabel = folder
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");

            optgroup.label = `📦 ${prettyLabel.toUpperCase()}`;

            groups[folder].forEach((sc) => {
                const option = document.createElement("option");
                option.value = sc.name;
                option.innerText = `⚡ ${sc.name}`;
                optgroup.appendChild(option);
            });

            selectScenario.appendChild(optgroup);
        });
    } catch (e) {
        selectScenario.innerHTML =
            '<option value="" disabled>Error loading scenarios.</option>';
    }
}

let globalEnvConfig = {};

function updateEnvPreview() {
    const selectedEnv = selectEnv.value.toUpperCase();
    let url = "";

    if (selectedEnv === "DEV") {
        url =
            globalEnvConfig["BASE_URL_DEV"] ||
            globalEnvConfig["BASE_URL"] ||
            "http://localhost:3333";
    } else if (selectedEnv === "STG") {
        url =
            globalEnvConfig["BASE_URL_STG"] ||
            "https://stg-api.pulse-project.com";
    } else if (selectedEnv === "PROD") {
        url =
            globalEnvConfig["BASE_URL_PROD"] || "https://api.pulse-project.com";
    }

    const previewText = document.getElementById("env-url-preview-text");
    if (previewText) {
        previewText.innerText = url;
    }
}

selectEnv.addEventListener("change", updateEnvPreview);

async function loadEnvConfig() {
    try {
        globalEnvConfig = await window.electronAPI.getEnvConfig();
        envVariablesList.innerHTML = "";

        Object.keys(globalEnvConfig).forEach((key) => {
            addEnvRow(key, globalEnvConfig[key]);
        });

        updateEnvPreview();
    } catch (e) {
        console.error("Error loading env:", e);
    }
}

function addEnvRow(key = "", value = "") {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="env-input-key" value="${key}" placeholder="VAR_NAME"></td>
        <td>
            <div class="env-value-wrapper">
                <input type="password" class="env-input-val" value="${value}" placeholder="value">
                <button class="btn-toggle-val" title="Toggle Visibility" type="button">
                    <svg class="eye-open" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="eye-closed hidden" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
            </div>
        </td>
        <td><button class="btn btn-danger btn-sm btn-delete-env">Delete</button></td>
    `;

    const inputVal = tr.querySelector(".env-input-val");
    const btnToggle = tr.querySelector(".btn-toggle-val");
    const eyeOpen = tr.querySelector(".eye-open");
    const eyeClosed = tr.querySelector(".eye-closed");

    btnToggle.addEventListener("click", () => {
        if (inputVal.type === "password") {
            inputVal.type = "text";
            eyeOpen.classList.add("hidden");
            eyeClosed.classList.remove("hidden");
        } else {
            inputVal.type = "password";
            eyeOpen.classList.remove("hidden");
            eyeClosed.classList.add("hidden");
        }
    });

    tr.querySelector(".btn-delete-env").addEventListener("click", () => {
        tr.remove();
    });

    envVariablesList.appendChild(tr);
}

btnAddEnvRow.addEventListener("click", () => {
    addEnvRow();
});

btnSaveEnv.addEventListener("click", async () => {
    const config = {};
    const rows = envVariablesList.querySelectorAll("tr");
    rows.forEach((row) => {
        const key = row.querySelector(".env-input-key").value.trim();
        const val = row.querySelector(".env-input-val").value.trim();
        if (key) {
            config[key] = val;
        }
    });

    const res = await window.electronAPI.saveEnvConfig(config);
    if (res.success) {
        showToast("Success", "Environment variables saved successfully!", "success");
        loadEnvConfig();
    } else {
        showToast("Error", "Failed to save: " + res.error, "error");
    }
});

function startTimer() {
    testSeconds = 0;
    testTimer.innerText = "00:00";
    testDurationTimer = setInterval(() => {
        testSeconds++;
        const mins = String(Math.floor(testSeconds / 60)).padStart(2, "0");
        const secs = String(testSeconds % 60).padStart(2, "0");
        testTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (testDurationTimer) {
        clearInterval(testDurationTimer);
        testDurationTimer = null;
    }
}

btnLaunchTest.addEventListener("click", async () => {
    const scenario = selectScenario.value;
    const env = selectEnv.value;

    if (!scenario) {
        showToast("Select Scenario", "Please select a scenario profile first!", "info");
        return;
    }

    switchTab("console-logs");

    k6RawLogTextBuffer = `[Pulse CLI] Dispatching k6 Load Scenario: "${scenario}"...\n`;
    k6Terminal.textContent = k6RawLogTextBuffer;
    isTestRunning = true;

    btnLaunchTest.classList.add("hidden");
    btnAbortTest.classList.remove("hidden");
    testStatusBadge.innerText = "RUNNING";
    testStatusBadge.style.color = "var(--primary)";
    progressRing.classList.add("running");
    activeScenarioName.innerText = scenario;
    activeEnvName.innerText = env.toUpperCase();
    executionProgressBar.style.width = "40%";

    startTimer();

    const res = await window.electronAPI.runTest({
        scenario,
        env,
    });
    if (!res.success) {
        k6Terminal.innerText += `\nError launching test: ${res.error}\n`;
        stopTestUI(1);
    }
});

btnAbortTest.addEventListener("click", async () => {
    k6Terminal.innerText += `\n[Pulse CLI] Aborting running test...`;
    await window.electronAPI.killTest();
});

function stopTestUI(code) {
    isTestRunning = false;
    stopTimer();
    btnLaunchTest.classList.remove("hidden");
    btnAbortTest.classList.add("hidden");
    progressRing.classList.remove("running");

    if (code === 0) {
        testStatusBadge.innerText = "SUCCESS";
        testStatusBadge.style.color = "var(--success)";
        executionProgressBar.style.width = "100%";
        loadHTMLReport();
    } else {
        testStatusBadge.innerText = "FAILED";
        testStatusBadge.style.color = "var(--error)";
        executionProgressBar.style.width = "0%";
    }
}

function stripAnsi(text) {
    return text.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        "",
    );
}

function formatK6Log(line) {
    if (line.includes("level=") && line.includes("msg=")) {
        const msgMatch =
            line.match(/msg="((?:[^"\\]|\\.)*)"/) || line.match(/msg=([^\s]+)/);
        if (msgMatch) {
            let msg = msgMatch[1];
            msg = msg
                .replace(/\\"/g, '"')
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t");

            try {
                const parsed = JSON.parse(msg);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return msg;
            }
        }
    }

    try {
        const parsed = JSON.parse(line.trim());
        return JSON.stringify(parsed, null, 2);
    } catch (e) {}

    return line;
}

let testLogBuffer = "";

function handleTestLogChunk(chunk) {
    testLogBuffer += chunk;
    const lines = testLogBuffer.split("\n");
    testLogBuffer = lines.pop();

    let formattedOutput = "";
    for (const line of lines) {
        const cleanLine = stripAnsi(line);
        const trimmed = cleanLine.trim();

        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            formattedOutput += formatK6Log(cleanLine) + "\n";
        } else if (cleanLine.includes("level=") && cleanLine.includes("msg=")) {
            formattedOutput += formatK6Log(cleanLine) + "\n";
        } else {
            formattedOutput += cleanLine + "\n";
        }
    }

    if (formattedOutput) {
        k6RawLogTextBuffer += formattedOutput;
        if (k6SearchInput && k6SearchInput.value) {
            performLogSearch();
        } else {
            k6Terminal.appendChild(document.createTextNode(formattedOutput));
            k6Terminal.scrollTop = k6Terminal.scrollHeight;
        }
    }
}
window.electronAPI.onTestLog((chunk) => {
    handleTestLogChunk(chunk);
});

window.electronAPI.onTestFinished((code) => {
    const finishedText = `\n\n[Pulse CLI] Test Execution Finished with code ${code}.\n`;
    k6RawLogTextBuffer += finishedText;
    if (k6SearchInput && k6SearchInput.value) {
        performLogSearch();
        stopTestUI(code);
    } else {
        k6Terminal.appendChild(document.createTextNode(finishedText));
        stopTestUI(code);
    }
});

let currentMatchIndex = -1;
let matchCount = 0;

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function performLogSearch() {
    const query = k6SearchInput.value;
    if (!query) {
        k6Terminal.textContent = k6RawLogTextBuffer;
        k6SearchCounter.innerText = "0 / 0";
        currentMatchIndex = -1;
        matchCount = 0;
        k6Terminal.scrollTop = k6Terminal.scrollHeight;
        return;
    }

    const rawText = k6RawLogTextBuffer;
    const escapedText = rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const regex = new RegExp(escapeRegExp(query), "gi");
    let index = 0;

    const matches = escapedText.match(regex);
    if (!matches) {
        k6Terminal.innerHTML = escapedText;
        k6SearchCounter.innerText = "0 / 0";
        currentMatchIndex = -1;
        matchCount = 0;
        return;
    }

    matchCount = matches.length;
    if (currentMatchIndex < 0 || currentMatchIndex >= matchCount) {
        currentMatchIndex = 0;
    }

    const highlighted = escapedText.replace(regex, (match) => {
        const id = `k6-match-${index}`;
        const isCurrent = index === currentMatchIndex;
        index++;
        return `<span class="log-highlight ${isCurrent ? "active-highlight" : ""}" id="${id}">${match}</span>`;
    });

    k6Terminal.innerHTML = highlighted;
    k6SearchCounter.innerText = `${currentMatchIndex + 1} / ${matchCount}`;

    const activeSpan = document.getElementById(`k6-match-${currentMatchIndex}`);
    if (activeSpan) {
        k6Terminal.scrollTop =
            activeSpan.offsetTop - k6Terminal.clientHeight / 2;
    }
}

k6SearchInput.addEventListener("input", () => {
    currentMatchIndex = 0;
    performLogSearch();
});

k6SearchPrev.addEventListener("click", () => {
    if (matchCount > 0) {
        currentMatchIndex = (currentMatchIndex - 1 + matchCount) % matchCount;
        performLogSearch();
    }
});

k6SearchNext.addEventListener("click", () => {
    if (matchCount > 0) {
        currentMatchIndex = (currentMatchIndex + 1) % matchCount;
        performLogSearch();
    }
});

btnClearK6Logs.addEventListener("click", () => {
    k6RawLogTextBuffer = "Terminal cleared. Ready.\n";
    k6Terminal.textContent = k6RawLogTextBuffer;
    testLogBuffer = "";
    if (k6SearchInput) {
        k6SearchInput.value = "";
        k6SearchCounter.innerText = "0 / 0";
    }
    currentMatchIndex = -1;
    matchCount = 0;
});

async function loadHTMLReport() {
    try {
        const reportHtml = await window.electronAPI.getReport();
        if (reportHtml) {
            reportIframe.srcdoc = reportHtml;
            reportIframe.classList.remove("hidden");
            reportPlaceholder.classList.add("hidden");
        } else {
            reportIframe.classList.add("hidden");
            reportPlaceholder.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Error loading HTML report:", e);
    }
}

btnReloadReport.addEventListener("click", loadHTMLReport);

function addMockActivity(text, type = "system") {
    const item = document.createElement("div");
    item.className = `activity-item ${type}`;
    const time = new Date().toLocaleTimeString();
    item.innerText = `[${time}] ${text}`;
    mockActivityFeed.appendChild(item);
    mockActivityFeed.scrollTop = mockActivityFeed.scrollHeight;
}

btnStartMock.addEventListener("click", async () => {
    addMockActivity("Port binding request: Port 3333...", "system");
    const res = await window.electronAPI.startMockServer();
    if (res.success) {
        isMockRunning = true;
        btnStartMock.classList.add("hidden");
        btnStopMock.classList.remove("hidden");
        mockBigIndicator.innerText = "ONLINE";
        mockBigIndicator.className = "status-indicator online";
        mockStatusDot.className = "status-dot green";
        mockStatusText.innerText = "Mock: Port 3333";
        addMockActivity("Server listening on http://localhost:3333", "system");
    } else {
        addMockActivity(`Failed to start server: ${res.error}`, "system");
    }
});

btnStopMock.addEventListener("click", async () => {
    const res = await window.electronAPI.stopMockServer();
    if (res.success) {
        isMockRunning = false;
        btnStartMock.classList.remove("hidden");
        btnStopMock.classList.add("hidden");
        mockBigIndicator.innerText = "OFFLINE";
        mockBigIndicator.className = "status-indicator";
        mockStatusDot.className = "status-dot";
        mockStatusText.innerText = "Mock: Stopped";
        addMockActivity("Mock server gracefully terminated.", "system");
    }
});

let mockLogBuffer = "";

function handleMockLogChunk(chunk) {
    mockLogBuffer += chunk;
    const lines = mockLogBuffer.split("\n");

    mockLogBuffer = lines.pop();

    let formattedOutput = "";
    for (const line of lines) {
        const cleanLine = stripAnsi(line);
        if (cleanLine.trim() === "") {
            formattedOutput += "\n";
            continue;
        }

        const time = new Date().toLocaleTimeString();
        formattedOutput += `[${time}] ${cleanLine}\n`;

        if (
            cleanLine.includes("GET") ||
            cleanLine.includes("POST") ||
            cleanLine.includes("PUT") ||
            cleanLine.includes("DELETE")
        ) {
            addMockActivity(cleanLine.trim(), "request");
        }
    }

    if (formattedOutput) {
        if (
            mockTerminal.textContent.includes(
                "Mock server logs will stream here...",
            )
        ) {
            mockTerminal.textContent = "";
        }
        mockTerminal.appendChild(document.createTextNode(formattedOutput));
        mockTerminal.scrollTop = mockTerminal.scrollHeight;
    }
}

window.electronAPI.onMockLog((chunk) => {
    handleMockLogChunk(chunk);
});

window.electronAPI.onMockFinished((code) => {
    isMockRunning = false;
    btnStartMock.classList.remove("hidden");
    btnStopMock.classList.add("hidden");
    mockBigIndicator.innerText = "OFFLINE";
    mockBigIndicator.className = "status-indicator";
    mockStatusDot.className = "status-dot";
    mockStatusText.innerText = "Mock: Stopped";
    addMockActivity(`Mock server shut down with status ${code}.`, "system");
});

btnClearMockLogs.addEventListener("click", () => {
    mockTerminal.innerText = "Terminal cleared. Ready.";
});

checkK6();
loadScenarios();
loadEnvConfig();
loadHTMLReport();
setInterval(async () => {
    const active = await window.electronAPI.getMockStatus();
    if (active && !isMockRunning) {
        isMockRunning = true;
        btnStartMock.classList.add("hidden");
        btnStopMock.classList.remove("hidden");
        mockBigIndicator.innerText = "ONLINE";
        mockBigIndicator.className = "status-indicator online";
        mockStatusDot.className = "status-dot green";
        mockStatusText.innerText = "Mock: Port 3333";
    }
}, 3000);

// ==========================================
// cURL Scenario Generator Logic
// ==========================================

// Tokenize command string (handling quotes, backslash line continuations)
function parseShellCommand(cmdStr) {
    const args = [];
    let current = '';
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let escaped = false;

    for (let i = 0; i < cmdStr.length; i++) {
        const char = cmdStr[i];
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === '\\') {
            if (cmdStr[i + 1] === '\n') {
                i++; // Skip backslash and newline (line continuation)
            } else {
                escaped = true;
            }
            continue;
        }
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            continue;
        }
        if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            continue;
        }
        if ((char === ' ' || char === '\t' || char === '\n' || char === '\r') && !inDoubleQuotes && !inSingleQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
            continue;
        }
        current += char;
    }
    if (current) {
        args.push(current);
    }
    return args;
}

// Complete cURL parser
function parseCurlCommand(curlStr) {
    const args = parseShellCommand(curlStr.trim());
    let method = "GET";
    const headers = {};
    let body = "";
    let url = "";

    const skipSet = new Set([
        "-X", "--request",
        "-H", "--header",
        "-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode",
        "-A", "--user-agent",
        "-u", "--user",
        "-b", "--cookie",
        "-c", "--cookie-jar",
        "-o", "--output"
    ]);

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "-X" || arg === "--request") {
            method = args[i + 1]?.toUpperCase() || "GET";
            i++;
        } else if (arg === "-H" || arg === "--header") {
            const headerStr = args[i + 1] || "";
            const colonIndex = headerStr.indexOf(":");
            if (colonIndex > -1) {
                const key = headerStr.slice(0, colonIndex).trim();
                const val = headerStr.slice(colonIndex + 1).trim();
                headers[key] = val;
            }
            i++;
        } else if (arg === "-d" || arg === "--data" || arg === "--data-raw" || arg === "--data-binary" || arg === "--data-ascii" || arg === "--data-urlencode") {
            body = args[i + 1] || "";
            if (method === "GET") {
                method = "POST";
            }
            i++;
        } else if (arg.startsWith("-")) {
            if (skipSet.has(arg)) {
                i++;
            }
        } else {
            // Treat as URL if not already captured and does not start with -
            if (!url && (arg.startsWith("http://") || arg.startsWith("https://") || arg.includes("/") || arg.includes("."))) {
                url = arg;
            }
        }
    }

    return { method, url, headers, body };
}

const genScenarioNameInput = document.getElementById("generator-scenario-name");
const genNameError = document.getElementById("generator-name-error");
const genCurlInput = document.getElementById("generator-curl-input");
const btnGenerateScenario = document.getElementById("btn-generate-scenario");

const previewEmpty = document.getElementById("generator-preview-empty");
const previewDetails = document.getElementById("generator-preview-details");
const previewMethod = document.getElementById("preview-method");
const previewUrl = document.getElementById("preview-url");
const previewBaseUrl = document.getElementById("preview-base-url");
const previewEndpointPath = document.getElementById("preview-endpoint-path");
const previewQueriesTitle = document.getElementById("preview-queries-title");
const previewQueriesWrapper = document.getElementById("preview-queries-wrapper");
const previewQueriesList = document.getElementById("preview-queries-list");
const previewHeadersList = document.getElementById("preview-headers-list");
const previewBodyTitle = document.getElementById("preview-body-title");
const previewBodyContent = document.getElementById("preview-body-content");

// Validation helper
function validateScenarioName(name) {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

genScenarioNameInput.addEventListener("input", () => {
    const val = genScenarioNameInput.value.trim();
    if (val === "" || validateScenarioName(val)) {
        genNameError.classList.add("hidden");
    } else {
        genNameError.classList.remove("hidden");
    }
});

let parsedCurlData = null;

function updateCurlPreview() {
    const curlVal = genCurlInput.value.trim();
    if (!curlVal) {
        previewEmpty.classList.remove("hidden");
        previewDetails.classList.add("hidden");
        parsedCurlData = null;
        return;
    }

    try {
        const parsed = parseCurlCommand(curlVal);
        parsedCurlData = parsed;

        previewEmpty.classList.add("hidden");
        previewDetails.classList.remove("hidden");

        // Set Method badge
        previewMethod.innerText = parsed.method;
        previewMethod.className = `preview-method-badge ${parsed.method.toLowerCase()}`;

        // Set URL text
        previewUrl.innerText = parsed.url || "(No URL detected)";
        
        let rawUrl = parsed.url || "http://localhost:3333";
        if (!rawUrl.includes("://")) {
            rawUrl = "https://" + rawUrl;
        }
        
        let urlObj;
        try {
            urlObj = new URL(rawUrl);
            previewBaseUrl.innerText = `${urlObj.protocol}//${urlObj.host}`;
            previewEndpointPath.innerText = urlObj.pathname;
        } catch (e) {
            previewBaseUrl.innerText = "-";
            previewEndpointPath.innerText = "-";
            urlObj = null;
        }

        // Render Queries
        previewQueriesList.innerHTML = "";
        if (urlObj && Array.from(urlObj.searchParams.keys()).length > 0) {
            previewQueriesTitle.classList.remove("hidden");
            previewQueriesWrapper.classList.remove("hidden");
            urlObj.searchParams.forEach((val, key) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${key}</td><td>${val}</td>`;
                previewQueriesList.appendChild(tr);
            });
        } else {
            previewQueriesTitle.classList.add("hidden");
            previewQueriesWrapper.classList.add("hidden");
        }

        // Render Headers
        previewHeadersList.innerHTML = "";
        const headerKeys = Object.keys(parsed.headers);
        if (headerKeys.length > 0) {
            headerKeys.forEach(key => {
                const val = parsed.headers[key];
                const tr = document.createElement("tr");
                const isAuth = key.toLowerCase() === "authorization";
                tr.innerHTML = `<td>${key}</td><td style="${isAuth ? 'color: #f59e0b; font-weight: 600;' : ''}">${val} ${isAuth ? '🔑 (Parameterizado)' : ''}</td>`;
                previewHeadersList.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="2" style="color: var(--text-muted); font-style: italic; text-align: center;">No headers parsed</td>`;
            previewHeadersList.appendChild(tr);
        }

        // Render Request Body
        if (parsed.body) {
            previewBodyTitle.classList.remove("hidden");
            previewBodyContent.classList.remove("hidden");
            try {
                const formattedBody = JSON.stringify(JSON.parse(parsed.body), null, 2);
                previewBodyContent.innerText = formattedBody;
                previewBodyContent.style.color = "#38bdf8"; // vivid light blue
            } catch (e) {
                previewBodyContent.innerText = parsed.body;
                previewBodyContent.style.color = "#f43f5e"; // soft warning red
            }
        } else {
            previewBodyTitle.classList.add("hidden");
            previewBodyContent.classList.add("hidden");
        }
    } catch (err) {
        console.error("Preview parser error:", err);
    }
}

genCurlInput.addEventListener("input", updateCurlPreview);

btnGenerateScenario.addEventListener("click", async () => {
    const name = genScenarioNameInput.value.trim();
    if (!name) {
        showToast("Missing Name", "Please provide a scenario name first!", "info");
        return;
    }
    if (!validateScenarioName(name)) {
        showToast("Invalid Name", "Scenario name is invalid! Use kebab-case (e.g. my-scenario).", "error");
        return;
    }
    if (!parsedCurlData) {
        showToast("Missing cURL", "Please paste a valid cURL command first!", "info");
        return;
    }
    if (!parsedCurlData.url) {
        showToast("Missing URL", "The pasted cURL command is missing a valid HTTP URL!", "error");
        return;
    }

    try {
        btnGenerateScenario.disabled = true;
        btnGenerateScenario.innerText = "⏳ Generating files...";
        
        const res = await window.electronAPI.generateScenarioFromCurl({
            name,
            parsedCurl: parsedCurlData
        });

        if (res.success) {
            showToast("Generation Successful", `Load test scenario "${name}" has been successfully generated inside "src/"!`, "success");
            
            // Clear inputs
            genScenarioNameInput.value = "";
            genCurlInput.value = "";
            previewEmpty.classList.remove("hidden");
            previewDetails.classList.add("hidden");
            parsedCurlData = null;

            // Automatically reload scenarios to populate the Control Room dropdown instantly!
            await loadScenarios();

            // Switch to the Control Room tab so they can run it
            switchTab("control-room");

            // Select the newly created scenario in the dropdown
            setTimeout(() => {
                selectScenario.value = name;
            }, 100);
        } else {
            showToast("Generation Error", res.error, "error");
        }
    } catch (e) {
        showToast("Generation Failed", e.message, "error");
    } finally {
        btnGenerateScenario.disabled = false;
        btnGenerateScenario.innerText = "✨ Generate Scenario Files";
    }
});
