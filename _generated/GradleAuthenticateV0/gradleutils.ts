import fs = require('fs');
import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { getSystemAccessToken } from 'azure-pipelines-tasks-artifacts-common/webapi'

import * as os from 'os';
import * as fse from 'fs-extra';

import { getPackagingServiceConnections, ServiceConnectionAuthType, UsernamePasswordServiceConnection, TokenServiceConnection, PrivateKeyServiceConnection } from "azure-pipelines-tasks-artifacts-common/serviceConnectionUtils";

export interface GradleCredential {
    id: string;
    username: string;
    password: string;
}

/**
 * Sanitizes a feed/repository name to be used as a Gradle property key
 * Gradle properties use alphanumeric, dots, and underscores
 */
export function sanitizePropertyKey(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getInternalFeedsCredentials(input: string): GradleCredential[] {
    const feeds: string[] = tl.getDelimitedInput(input, ",", false);
    var credentials: GradleCredential[] = [];

    if (!feeds || feeds.length === 0)
    {
        return credentials;
    }

    tl.debug(tl.loc('Info_GeneratingInternalFeeds', feeds.length));
    for (let feed of feeds) {
        credentials.push({
                id: feed,
                username: "AzureDevOps",
                password: getSystemAccessToken()
            });
    }

    return credentials;
}

export function getExternalServiceEndpointsCredentials(input: string): GradleCredential[] {
    var serviceConnections = getPackagingServiceConnections(input, ["REPOSITORYID"]);
    var credentials: GradleCredential[] = [];
    if (!serviceConnections || serviceConnections.length === 0)
    {
        return credentials;
    }

    tl.debug(tl.loc("Info_GeneratingExternalRepositories", serviceConnections.length));
    for(let serviceConnection of serviceConnections) {
        switch (serviceConnection.authType) {
            case (ServiceConnectionAuthType.UsernamePassword):
                const usernamePasswordAuthInfo = serviceConnection as UsernamePasswordServiceConnection;

                credentials.push({
                    id: serviceConnection.additionalData["REPOSITORYID"],
                    username: usernamePasswordAuthInfo.username,
                    password: usernamePasswordAuthInfo.password,
                });

                tl.debug(`Detected username/password credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.Token):
                const tokenAuthInfo = serviceConnection as TokenServiceConnection;
                credentials.push({
                    id: serviceConnection.additionalData["REPOSITORYID"],
                    username: "AzureDevOps",
                    password: tokenAuthInfo.token
                });
                tl.debug(`Detected token credentials for '${serviceConnection.packageSource.uri}'`);
                break;
            case (ServiceConnectionAuthType.PrivateKey):
                // Gradle doesn't natively support private key auth like Maven, use as password
                const privateKeyAuthInfo = serviceConnection as PrivateKeyServiceConnection;
                tl.warning(`Private key authentication is not supported for Gradle. Skipping '${serviceConnection.packageSource.uri}'`);
                break;
            default:
                throw Error(tl.loc('Error_InvalidServiceConnection', serviceConnection.packageSource.uri));
        }
    }   

    return credentials;
}

export function readGradlePropertiesFile(filePath: string): string {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return "";
}

export function writeGradlePropertiesFile(filePath: string, content: string): void {
    fse.mkdirpSync(path.dirname(filePath));
    fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
}

/**
 * Checks if a credential already exists in the gradle.properties content
 */
export function credentialExists(propertiesContent: string, id: string): boolean {
    const sanitizedId = sanitizePropertyKey(id);
    const usernameKey = `${sanitizedId}Username`;
    const passwordKey = `${sanitizedId}Password`;
    
    // Check if either username or password property already exists
    const lines = propertiesContent.split(/\r?\n/);
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith(usernameKey + '=') || trimmedLine.startsWith(passwordKey + '=')) {
            return true;
        }
    }
    return false;
}

/**
 * Adds a credential entry to gradle.properties content
 * Gradle credentials are stored as properties that can be referenced in build.gradle:
 * 
 * feedNameUsername=AzureDevOps
 * feedNamePassword=token_value
 * 
 * In build.gradle, these can be used like:
 * repositories {
 *     maven {
 *         url "https://pkgs.dev.azure.com/org/project/_packaging/feedName/maven/v1"
 *         credentials {
 *             username = project.findProperty("feedNameUsername") ?: ""
 *             password = project.findProperty("feedNamePassword") ?: ""
 *         }
 *     }
 * }
 */
export function addCredentialToGradleProperties(propertiesContent: string, credential: GradleCredential): string {
    const sanitizedId = sanitizePropertyKey(credential.id);
    
    // Check if credential already exists
    if (credentialExists(propertiesContent, credential.id)) {
        tl.warning(tl.loc('Warning_FeedEntryAlreadyExists', credential.id));
        tl.debug('Entry: ' + credential.id);
        return propertiesContent;
    }

    const usernameEntry = `${sanitizedId}Username=${credential.username}`;
    const passwordEntry = `${sanitizedId}Password=${credential.password}`;

    // Add newline if content doesn't end with one
    let newContent = propertiesContent;
    if (newContent.length > 0 && !newContent.endsWith('\n') && !newContent.endsWith('\r\n')) {
        newContent += os.EOL;
    }

    // Add a comment and the credentials
    newContent += `# Azure Artifacts credentials for ${credential.id}${os.EOL}`;
    newContent += `${usernameEntry}${os.EOL}`;
    newContent += `${passwordEntry}${os.EOL}`;

    return newContent;
}
