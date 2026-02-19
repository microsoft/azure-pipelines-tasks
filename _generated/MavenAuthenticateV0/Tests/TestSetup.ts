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

// Environment variable keys for test configuration
export const TestEnvVars = {
    artifactsFeeds: '__artifactsFeeds__',
    mavenServiceConnections: '__mavenServiceConnections__',
    workloadIdentityServiceConnection: '__workloadIdentityServiceConnection__',
    verbosity: '__verbosity__',
    settingsXmlExists: '__settingsXmlExists__',
    settingsXmlContent: '__settingsXmlContent__',
    m2FolderExists: '__m2FolderExists__',
    systemAccessToken: '__systemAccessToken__',
    wifToken: '__wifToken__',
    wifShouldFail: '__wifShouldFail__'
};

// When this file is executed by MockTestRunner
const taskPath = path.join(__dirname, '..', 'mavenauth.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Get actual user home directory
const userHomeDir = process.env.USERPROFILE || process.env.HOME || '';
const m2DirPath = path.join(userHomeDir, '.m2');
const settingsXmlPath = path.join(m2DirPath, 'settings.xml');

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

tr.run();
