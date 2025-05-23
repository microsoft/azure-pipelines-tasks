import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', '..', 'operations', 'KuduServiceUtils.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Mock getBoolFeatureFlag to enable extension version support
tr.registerMock('azure-pipelines-task-lib/task', {
    getBoolFeatureFlag: function(name: string) {
        if (name === 'AzureAppServiceManageV0.ExtensionVersionSupport') {
            return true;
        }
        return false;
    },
    debug: function(message: string) {
        console.log(`[DEBUG] ${message}`);
    },
    loc: function(message: string, ...params: any[]) {
        return message;
    },
    warning: function(message: string) {
        console.log(`[WARNING] ${message}`);
    },
    setVariable: function(name: string, value: string) {
        console.log(`Setting variable ${name} to ${value}`);
    }
});

// Test function to simulate the version parsing logic
function testVersionParsing() {
    const extensionList = [
        'TestExtension(1.2.3)',
        'TestLatestExtension(latest)',
        'TestNoVersion'
    ];
    
    for (let i = 0; i < extensionList.length; i++) {
        let extensionID = extensionList[i];
        let version = "";
        let forceUpdate = false;
        
        console.log(`Parsing extension: ${extensionID}`);
        
        // Check if extensionID contains version information in format extensionID(version)
        const parenthesesRegex = /^(.*)\(([^)]*)\)$/;
        const parenthesesMatch = extensionID.match(parenthesesRegex);
        if (parenthesesMatch && parenthesesMatch.length >= 3) {
            extensionID = parenthesesMatch[1]; // Extension ID
            version = parenthesesMatch[2] || ""; // Version
        }
        
        // If version is 'latest', we force an update even if extension is already installed
        if (version === 'latest') {
            forceUpdate = true;
        }
        
        console.log(`Extension ID: ${extensionID}, Version: ${version}`);
        console.log(`Force update for ${extensionID}: ${forceUpdate}`);
    }
}

// Call the test function
testVersionParsing();

tr.run();