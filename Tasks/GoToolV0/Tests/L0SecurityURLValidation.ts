import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as fs from 'fs';

// Test various SSRF attack vectors to ensure they're blocked
const attackVectors = [
    // URL parser confusion
    'https://go.dev@evil.com/malicious',
    'https://user:pass@evil.com/golang',
    'https://go.dev:evil.com/dl',
    
    // Fragment/query manipulation
    'https://evil.com#@go.dev/dl',
    'https://evil.com?redirect=go.dev/dl',
    'https://evil.com/../go.dev/dl',
    
    // URL encoding attacks
    'https://go.dev%2F@evil.com',
    'https://go.dev%252F@evil.com',
    'https://go.dev%0D%0A@evil.com',
    
    // Path traversal
    'https://go.dev/dl/../../evil.com',
    'https://go.dev/dl/../../../etc/passwd',
    
    // Protocol confusion
    'file:///etc/passwd',
    'javascript://go.dev%0Aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    
    // Subdomain confusion
    'https://go.dev.evil.com/dl',
    'https://evil-go.dev/dl',
    'https://go-dev.com/dl',
    
    // Case manipulation (should be caught by lowercase check)
    'https://GO.DEV/DL',
    'https://Go.Dev/dl',
    
    // Port manipulation
    'https://go.dev:8080/dl',
    'https://go.dev:443@evil.com',
    
    // Backslash confusion
    'https://go.dev\\evil.com/dl',
    'https:\\\\go.dev\\dl',
    
    // IP address attempts
    'https://1.2.3.4/dl',
    'https://127.0.0.1/dl',
    'https://[::1]/dl',
    
    // CRLF injection
    'https://go.dev%0D%0AHost:%20evil.com/dl',
    'https://go.dev\r\nHost: evil.com/dl',
];

// Create temporary directory for test
const tempDir = path.join(__dirname, '_temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Mock environment variables BEFORE creating TaskMockRunner
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use first attack vector for this test instance
const attackUrl = attackVectors[0];
console.log(`Testing attack vector: ${attackUrl}`);

// Set inputs with malicious URL
tmr.setInput('version', '1.21.3');
tmr.setInput('goDownloadUrl', attackUrl);

// Mock tool lib functions - these should NOT be called if validation works
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log('❌ SECURITY FAILURE: findLocalTool called - URL validation bypassed!');
        return null;
    },
    downloadTool: function(url: string) {
        console.log(`❌ SECURITY FAILURE: downloadTool called with ${url} - URL validation bypassed!`);
        return Promise.reject(new Error('Security validation bypassed'));
    }
});

// Mock os module
tmr.registerMock('os', {
    platform: () => 'linux',
    arch: () => 'x64'
});

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any) {
        console.log(`Telemetry: ${area}.${feature}`);
    }
});

// Mock fs
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        return JSON.stringify([{
            version: "go1.21.3",
            stable: true
        }]);
    }
});

tmr.run();
