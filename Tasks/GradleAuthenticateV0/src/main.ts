// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { IssueSource } from 'azure-pipelines-task-lib/internal';
import { discoverFeedUrls } from './buildFileScanner';
import { writeAuthConfig, buildAuthEntries } from './authConfig';
import { resolveCiJar } from './ciJarResolver';
import { layoutMavenRepo } from './mavenLayout';
import { resolvePluginVersions } from './versionResolver';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import { isValidAzureArtifactsUrl } from './utils/urlUtils';
import { getGradleUserHome, prepareJobTempDirectory, writeJobInitScript } from './gradleTaskResources';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

const AUTH_CONFIG_NAME = 'azure-artifacts-auth-config.json';

async function run(): Promise<void> {
    let feedCount = 0;
    let isWifServiceConnection = false;
    let versionSource: string = 'none';
    let isPluginToolVersionIncluded = false;

    // Capture incoming settings before this invocation exports its own staging paths.
    const overrideTelemetry = {
        'IsGradleUserHomeEnvSet': !!process.env['GRADLE_USER_HOME'],
        'IsCredProviderHomeEnvSet': !!process.env['GRADLE_CREDPROVIDER_HOME'],
        'IsCiPluginRepoSet': !!tl.getVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO'),
        'IsAuthConfigSet': !!tl.getVariable('ARTIFACTS_GRADLE_AUTH_CONFIG'),
    };

    try {
        const inputs = readInputs();

        isWifServiceConnection = !!inputs.adoServiceConnection;
        isPluginToolVersionIncluded = !!inputs.pluginToolVersion;

        // Scan build files for Azure Artifacts feed URLs and merge with any
        // explicit repositoryUrl inputs. Returns deduplicated feed entries.
        const feeds = discoverFeedUrls(inputs.buildFiles, inputs.repositoryUrls);
        feedCount = feeds.length;
        logFeeds(feeds);

        const tempDir = prepareJobTempDirectory();
        const ciJar = resolveCiJar();
        tl.debug(tl.loc('Info_CiJarResolved'));

        const versionResult = resolvePluginVersions({ ...inputs, ciJarPath: ciJar.path });
        const versions = versionResult.versions;
        versionSource = versionResult.source;

        layoutMavenRepo(tempDir, ciJar.content, versions);
        tl.debug(tl.loc('Info_MavenRepoLaidOut'));

        if (!inputs.adoServiceConnection) {
            tl.warning(tl.loc('Warning_NoServiceConnection'), IssueSource.TaskInternal);
        }

        if (feeds.length === 0) {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('Info_NoFeedsNothingToConfigure'));
            return;
        }

        const authEntries = await buildAuthEntries(feeds, inputs.adoServiceConnection);
        const authConfigPath = path.join(tempDir, AUTH_CONFIG_NAME);
        writeAuthConfig(authConfigPath, authEntries);
        tl.debug(tl.loc('Info_AuthConfigWritten'));

        writeJobInitScript(inputs.gradleUserHome, versionResult.classpathVersion);
        tl.debug(tl.loc('Info_InitScriptWritten'));

        exportEnvironmentVariables(tempDir, authConfigPath);

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('Info_SuccessResult'));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        tl.setResult(tl.TaskResult.Failed, message);
    } finally {
        emitTelemetry('Packaging', 'GradleAuthenticateV0', {
            'FeedCount': feedCount,
            'IsWifServiceConnection': isWifServiceConnection,
            'VersionSource': versionSource,
            'IsBuildFilesIncluded': !!(tl.getInput('buildFiles', false)),
            'IsRepositoryUrlIncluded': !!(tl.getInput('repositoryUrl', false)),
            'IsPluginToolVersionIncluded': isPluginToolVersionIncluded,
            'IsGradleUserHomeIncluded': !!(tl.getInput('gradleUserHome', false)),
            ...overrideTelemetry,
            'CollectionId': tl.getVariable('System.CollectionId') || '',
            'HostType': tl.getVariable('System.HostType') || '',
            'AgentOS': tl.getVariable('Agent.OS') || '',
        });
    }
}

// ---------------------------------------------------------------------------
// Input reading
// ---------------------------------------------------------------------------

interface TaskInputs {
    buildFiles: string[];
    repositoryUrls: string[];
    adoServiceConnection: string;
    pluginToolVersion: string;
    gradleUserHome: string;
}

function readInputs(): TaskInputs {
    let buildFiles = splitLines(tl.getInput('buildFiles', false) || '');
    const repositoryUrls = [...new Set(splitLines(tl.getInput('repositoryUrl', false) || ''))];

    // Auto-discover Gradle build files in the working directory when not explicitly provided
    if (buildFiles.length === 0) {
        buildFiles = discoverBuildFiles();
    }

    if (buildFiles.length === 0 && repositoryUrls.length === 0) {
        throw new Error(tl.loc('Error_NoBuildFilesOrRepoUrls'));
    }

    const validUrls: string[] = [];
    for (const url of repositoryUrls) {
        if (!isValidAzureArtifactsUrl(url)) {
            tl.warning(tl.loc('Warning_InvalidRepositoryUrlSkipped'), IssueSource.TaskInternal);
            continue;
        }
        validUrls.push(url);
    }

    const pluginToolVersion = tl.getInput('pluginToolVersion', false) || '';

    return {
        buildFiles,
        repositoryUrls: validUrls,
        adoServiceConnection: tl.getInput('adoServiceConnection', false) || '',
        pluginToolVersion,
        gradleUserHome: getGradleUserHome(),
    };
}

// ---------------------------------------------------------------------------
// Logging & environment helpers
// ---------------------------------------------------------------------------

function logFeeds(feeds: { url: string; source: string }[]): void {
    if (feeds.length === 0) {
        tl.warning(tl.loc('Warning_NoFeedsFound'), IssueSource.TaskInternal);
    } else {
        for (const feed of feeds) {
            tl.debugExternalOutput(
                tl.loc('Info_DiscoveredFeed', feed.url, feed.source),
                { source: 'repository' });
        }
    }
}

function exportEnvironmentVariables(tempDir: string, authConfigPath: string): void {
    const repoDir = tempDir.replace(/\\/g, '/');
    tl.setVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO', repoDir);
    tl.setVariable('ARTIFACTS_GRADLE_AUTH_CONFIG', authConfigPath);
    tl.debug(tl.loc('Info_EnvVarsSet'));
}

function splitLines(raw: string): string[] {
    return raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}

const GRADLE_BUILD_FILE_NAMES = [
    'settings.gradle',
    'settings.gradle.kts',
    'build.gradle',
    'build.gradle.kts',
];

function discoverBuildFiles(): string[] {
    const cwd = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    const found: string[] = [];
    for (const name of GRADLE_BUILD_FILE_NAMES) {
        const filePath = path.join(cwd, name);
        if (fs.existsSync(filePath)) {
            found.push(filePath);
        }
    }
    if (found.length > 0) {
        tl.debugExternalOutput(
            tl.loc('Info_AutoDiscoveredBuildFiles', found.join(', ')),
            { source: 'repository' });
    }
    return found;
}

run();
