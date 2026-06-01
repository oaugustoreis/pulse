const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getScenarios: () => ipcRenderer.invoke('get-scenarios'),
    getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
    saveEnvConfig: (config) => ipcRenderer.invoke('save-env-config', config),
    runTest: (params) => ipcRenderer.invoke('run-test', params),
    killTest: () => ipcRenderer.invoke('kill-test'),
    getReport: () => ipcRenderer.invoke('get-report'),
    checkK6: () => ipcRenderer.invoke('check-k6-installation'),
    startMockServer: () => ipcRenderer.invoke('start-mock-server'),
    stopMockServer: () => ipcRenderer.invoke('stop-mock-server'),
    getMockStatus: () => ipcRenderer.invoke('get-mock-status'),
    generateScenarioFromCurl: (name, parsedCurl) => ipcRenderer.invoke('generate-scenario-from-curl', name, parsedCurl),
    onTestLog: (callback) => {
        const sub = (e, log) => callback(log);
        ipcRenderer.on('test-log', sub);
        return () => ipcRenderer.removeListener('test-log', sub);
    },
    onTestFinished: (callback) => {
        const sub = (e, code) => callback(code);
        ipcRenderer.on('test-finished', sub);
        return () => ipcRenderer.removeListener('test-finished', sub);
    },
    onMockLog: (callback) => {
        const sub = (e, log) => callback(log);
        ipcRenderer.on('mock-log', sub);
        return () => ipcRenderer.removeListener('mock-log', sub);
    },
    onMockFinished: (callback) => {
        const sub = (e, code) => callback(code);
        ipcRenderer.on('mock-finished', sub);
        return () => ipcRenderer.removeListener('mock-finished', sub);
    }
});
