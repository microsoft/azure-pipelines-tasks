// Test setup for MavenAuthenticate L0 tests
// This file is executed by MockTestRunner to set up the mock environment

import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { TestConstants } from './TestConstants';

export interface MavenTestOptions {
    artifactsFeeds?: string;
    mavenServiceConnections?: string;
    workloadIdentityServiceConnection?: string;
    verbosity?: string;
    settingsXmlExists?: boolean;
    settingsXmlContent?: string;
    m2FolderExists?: boolean;
    systemAccessToken?: string;
    wifToken?: string | null;
    wifShouldFail?: boolean;
}

// TestEnvVars lives in TestConstants.ts — import from there so test files
// can consume it without loading azure-pipelines-task-lib into the mocha process.
import { TestEnvVars } from './TestConstants';
export { TestEnvVars };

// When this file is executed by MockTestRunner
const taskPath = path.join(__dirname, '..', 'mavenauth.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set user home directory for tests - use a default test path
const userHomeDir = path.join(__dirname, 'testhome');
const m2DirPath = path.join(userHomeDir, '.m2');
const settingsXmlPath = path.join(m2DirPath, 'settings.xml');

// Ensure BOTH HOME and USERPROFILE environment variables are set for the task
// The task checks tl.osType() which is mocked, so set both to be safe
process.env.USERPROFILE = userHomeDir;
process.env.HOME = userHomeDir;

// Read configuration from environment variables
const artifactsFeeds = process.env[TestEnvVars.artifactsFeeds] || '';
const mavenServiceConnections = process.env[TestEnvVars.mavenServiceConnections] || '';
const workloadIdentityServiceConnection = process.env[TestEnvVars.workloadIdentityServiceConnection];
const verbosity = process.env[TestEnvVars.verbosity] || 'verbose';
const settingsXmlExists = process.env[TestEnvVars.settingsXmlExists] === 'true';
const settingsXmlContent = process.env[TestEnvVars.settingsXmlContent];
const m2FolderExists = process.env[TestEnvVars.m2FolderExists] !== 'false';
const systemAccessToken = process.env[TestEnvVars.systemAccessToken] || TestConstants.systemToken;
const wifToken = process.env[TestEnvVars.wifToken];
const wifShouldFail = process.env[TestEnvVars.wifShouldFail] === 'true';

// Suppress debug output in tests — SYSTEM_DEBUG=true is set globally by make.js
// for the test-runner process but should not be inherited by the task child process.
// Only propagate it if a test explicitly requests it via TestEnvVars.
delete process.env['SYSTEM_DEBUG'];

// Set task inputs
tr.setInput('artifactsFeeds', artifactsFeeds);
tr.setInput('verbosity', verbosity);
tr.setInput('mavenServiceConnections', mavenServiceConnections);

if (workloadIdentityServiceConnection) {
    tr.setInput('workloadIdentityServiceConnection', workloadIdentityServiceConnection);
}

// Mock webapi for System.AccessToken
const mockApi = {
    getSystemAccessToken: () => {
        return systemAccessToken;
    }
};
tr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

// Mock service connections
const mockServiceConnectionUtils = {
    ServiceConnectionAuthType: {
        UsernamePassword: 0,
        Token: 1,
        PrivateKey: 2
    },
    getPackagingServiceConnections: (input: string, requiredFields: string[]) => {
        const connectionIds = mavenServiceConnections.split(',').filter((id: string) => id.trim());
        const connections: any[] = [];
        
        for (const connectionId of connectionIds) {
            const trimmedId = connectionId.trim();
            
            if (trimmedId === 'tokenBased') {
                connections.push({
                    authType: 1,
                    packageSource: { uri: 'https://example.com/maven' },
                    additionalData: { 'REPOSITORYID': 'tokenBased' },
                    token: TestConstants.serviceConnections.tokenBased.token
                });
            } else if (trimmedId === 'usernamePasswordBased') {
                connections.push({
                    authType: 0,
                    packageSource: { uri: 'https://example.com/maven' },
                    additionalData: { 'REPOSITORYID': 'usernamePasswordBased' },
                    username: TestConstants.serviceConnections.usernamePassword.username,
                    password: TestConstants.serviceConnections.usernamePassword.password
                });
            } else if (trimmedId === 'privateKeyBased') {
                connections.push({
                    authType: 2,
                    packageSource: { uri: 'https://example.com/maven' },
                    additionalData: { 'REPOSITORYID': 'privateKeyBased' },
                    privateKey: TestConstants.serviceConnections.privateKey.privateKey,
                    passphrase: TestConstants.serviceConnections.privateKey.passphrase
                });
            }
        }
        
        return connections;
    }
};
tr.registerMock('azure-pipelines-tasks-artifacts-common/serviceConnectionUtils', mockServiceConnectionUtils);

// Mock telemetry
tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        // Silent mock for tests
    }
});

// Mock mavenutils
tr.registerMock('./mavenutils', {
    getInternalFeedsServerElements: (input: string) => {
        const feeds = artifactsFeeds.split(',').filter(f => f.trim());
        return feeds.map(feed => ({
            id: feed.trim(),
            username: 'AzureDevOps',
            password: systemAccessToken
        }));
    },
    getExternalServiceEndpointsServerElements: (input: string) => {
        return mockServiceConnectionUtils.getPackagingServiceConnections(input, ['REPOSITORYID'])
            .map((conn: any) => ({
                id: conn.additionalData['REPOSITORYID'],
                username: conn.username || 'AzureDevOps',
                password: conn.password || conn.token || '',
                privateKey: conn.privateKey,
                passphrase: conn.passphrase
            }));
    },
    readXmlFileAsJson: async (filePath: string) => {
        if (settingsXmlContent) {
            const xml2js = require('xml2js');
            const parser = new xml2js.Parser();
            return parser.parseStringPromise(settingsXmlContent);
        }
        return { settings: {} };
    },
    jsonToXmlConverter: async (filePath: string, jsonContent: any) => {
        // Write actual XML so tests can assert the server credential configuration.
        const xml2jsLib = require('xml2js');
        const fsLib = require('fs');
        const pathLib = require('path');
        fsLib.mkdirSync(pathLib.dirname(filePath), { recursive: true });
        const builder = new xml2jsLib.Builder();
        fsLib.writeFileSync(filePath, builder.buildObject(jsonContent));
        return Promise.resolve();
    },
    addRepositoryEntryToSettingsJson: function(json: any, serverJson:any): any {
        const tl = this.tl || require('azure-pipelines-task-lib/task');
        const os = require('os');
        
        if (!json) {
            json = {};
        }
        if (!json.settings || typeof json.settings === "string") {
            json.settings = {};
        }
        if (!json.settings.$) {
            json.settings.$ = {};
            json.settings.$['xmlns'] = 'http://maven.apache.org/SETTINGS/1.0.0';
            json.settings.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
            json.settings.$['xsi:schemaLocation'] = 'http://maven.apache.org/SETTINGS/1.0.0' + os.EOL + 'https://maven.apache.org/xsd/settings-1.0.0.xsd';
        }
        if (!json.settings.servers) {
            json.settings.servers = {};
        }
        
        // addPropToJson logic inlined
        let obj = json.settings.servers;
        const propName = 'server';
        const value = serverJson;
        
        if (!obj) {
            obj = {};
        }

        // If the root 'obj' already contains a 'server' property set it as the root object.
        if (obj instanceof Array) {
            let propNode = obj.find(o => o[propName]);
            if (propNode) {
                obj = propNode;
            }
        }

        // Checks if an array contains a key
        let containsId = function(o) {
            if (value && value.id) {
                if (o.id instanceof Array) {
                    return o.id.find((v) => {
                        return v === value.id;
                    });
                } else {
                    return value.id === o.id;
                }
            }
            return false;
        };

        if (propName in obj) {
            if (obj[propName] instanceof Array) {
                let existing = obj[propName].find(containsId);
                if (existing) {
                    tl.warning(tl.loc('Warning_FeedEntryAlreadyExists', value.id));
                    tl.debug('Entry: ' + value.id);
                } else {
                    obj[propName].push(value);
                }
            } else if (typeof obj[propName] !== 'object') {
                obj[propName] = [obj[propName], value];
            } else {
                let prop = {};
                prop[propName] = value;
                obj[propName] = [obj[propName], value];
            }
        } else if (obj instanceof Array) {
            let existing = obj.find(containsId);
            if (existing) {
                tl.warning(tl.loc('Warning_FeedEntryAlreadyExists', value.id));
                tl.debug('Entry: ' + value.id);
            } else {
                let prop = {};
                prop[propName] = value;
                obj.push(prop);
            }
        } else {
            obj[propName] = value;
        }
        
        return json;
    }
});

// Mock WIF credentials if needed
if (workloadIdentityServiceConnection) {
    const mockWifModule = {
        getFederatedWorkloadIdentityCredentials: async (serviceConnectionName: string) => {
            if (wifShouldFail) {
                return null;
            }
            return wifToken || TestConstants.wif.token;
        },
        getFeedTenantId: async () => {
            return 'test-tenant-id';
        }
    };
    tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', mockWifModule);
}

// Setup file system answers
const existAnswers: any = {};
existAnswers[m2DirPath] = m2FolderExists;
existAnswers[settingsXmlPath] = settingsXmlExists;
const backupSettingsXmlPath = path.join(m2DirPath, '_settings.xml');
existAnswers[backupSettingsXmlPath] = false; // Backup doesn't exist initially

tr.setAnswers({
    osType: {
        'osType': 'Windows NT'
    },
    exist: existAnswers
});

// If settings.xml should exist, mock the file reading
if (settingsXmlExists && settingsXmlContent) {
    const fs = require('fs');
    const originalReadFileSync = fs.readFileSync;
    tr.registerMock('fs', {
        ...fs,
        readFileSync: (filePath: string, encoding?: string) => {
            if (filePath === settingsXmlPath) {
                return settingsXmlContent;
            }
            return originalReadFileSync(filePath, encoding);
        }
    });
}

// Only run when this file is executed directly by MockTestRunner
// (not when require'd by test files to access exported TestEnvVars)
if (require.main === module) {
    tr.run();
}
