// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { discoverFeedUrls } from './buildFileScanner';
import { writeAuthConfig, buildAuthEntries } from './authConfig';
import { resolveCiJar } from './ciJarResolver';
import { layoutMavenRepo } from './mavenLayout';
import { generateInitScript } from './initScript';
import { resolvePluginVersions } from './versionResolver';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import { isAzureArtifactsUrl } from './urlUtils';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

const INIT_SCRIPT_NAME = 'azure-artifacts-init.gradle';
const AUTH_CONFIG_NAME = 'azure-artifacts-auth-config.json';

async function run(): Promise<void> {
    let feedCount = 0;
    let isWifServiceConnection = false;
    let versionSource: string = 'none';

    try {
        const inputs = readInputs();

        isWifServiceConnection = !!inputs.adoServiceConnection;

        // Scan build files for Azure Artifacts feed URLs and merge with any
        // explicit repositoryUrl inputs. Returns deduplicated feed entries.
        const feeds = discoverFeedUrls(inputs.buildFiles, inputs.repositoryUrls);
        feedCount = feeds.length;
        logFeeds(feeds);

        const ciJarPath = resolveCiJar();
        console.log(tl.loc('Info_CiJarResolved', ciJarPath));

        const versionResult = resolvePluginVersions({ ...inputs, ciJarPath });

        const versions = versionResult.versions;
        versionSource = versionResult.source;

        // Reuse existing temp directory from a previous GradleAuthenticate run
        // in the same job (multi-invocation / additive scenario). This ensures
        // the Maven repo layout accumulates all versions across runs and the
        // auth config file is merged correctly.
        const existingRepoDir = tl.getVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO');
        const tempDir = existingRepoDir && fs.existsSync(existingRepoDir)
            ? existingRepoDir
            : path.join(os.tmpdir(), 'gradle-auth');
        fs.mkdirSync(tempDir, { recursive: true });

        layoutMavenRepo(tempDir, ciJarPath, versions);
        console.log(tl.loc('Info_MavenRepoLaidOut', tempDir, versions.join(', ')));

        if (!inputs.adoServiceConnection) {
            console.log(tl.loc('Warning_NoServiceConnection'));
        }

        if (feeds.length === 0) {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('Info_NoFeedsNothingToConfigure'));
            return;
        }

        const authEntries = await buildAuthEntries(feeds, inputs.adoServiceConnection);
        const authConfigPath = path.join(tempDir, AUTH_CONFIG_NAME);
        writeAuthConfig(authConfigPath, authEntries);
        console.log(tl.loc('Info_AuthConfigWritten', authConfigPath));

        exportEnvironmentVariables(tempDir, authConfigPath);

        const classpathVersion = inputs.pluginToolVersion || '+';
        const initScriptPath = writeInitScript(inputs.gradleUserHome, classpathVersion);
        console.log(tl.loc('Info_InitScriptWritten', initScriptPath));

        tl.setVariable('ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH', initScriptPath, false, false);
        tl.setVariable('ARTIFACTS_GRADLE_AUTH_TEMP_DIR', tempDir, false, false);

        tl.setResult(tl.TaskResult.Succeeded,
            tl.loc('Info_SuccessResult', feeds.length.toString(), versions.join(', ')));
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
            'IsPluginToolVersionIncluded': !!(tl.getInput('pluginToolVersion', false)),
            'IsGradleUserHomeIncluded': !!(tl.getInput('gradleUserHome', false)),
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
        if (!isAzureArtifactsUrl(url)) {
            tl.warning(tl.loc('Warning_RepositoryUrlNotAzureArtifacts', url));
        } else {
            validUrls.push(url);
        }
    }

    return {
        buildFiles,
        repositoryUrls: validUrls,
        adoServiceConnection: tl.getInput('adoServiceConnection', false) || '',
        pluginToolVersion: tl.getInput('pluginToolVersion', false) || '',
        gradleUserHome: tl.getInput('gradleUserHome', false) || getDefaultGradleUserHome(),
    };
}

// ---------------------------------------------------------------------------
// Logging & environment helpers
// ---------------------------------------------------------------------------

function logFeeds(feeds: { url: string; source: string }[]): void {
    if (feeds.length === 0) {
        tl.warning(tl.loc('Warning_NoFeedsFound'));
    }
    for (const feed of feeds) {
        console.log(tl.loc('Info_DiscoveredFeed', feed.url, feed.source));
    }
}

function exportEnvironmentVariables(tempDir: string, authConfigPath: string): void {
    // Normalize backslashes to forward slashes for the repo dir env var.
    // This value is used in Groovy init scripts as file:// URIs, which
    // require forward slashes on all platforms including Windows.
    const repoDir = tempDir.replace(/\\/g, '/');
    tl.setVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO', repoDir);
    tl.setVariable('ARTIFACTS_GRADLE_AUTH_CONFIG', authConfigPath);
    console.log(tl.loc('Info_EnvVarSet', 'ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO', repoDir));
    console.log(tl.loc('Info_EnvVarSet', 'ARTIFACTS_GRADLE_AUTH_CONFIG', authConfigPath));
}

function writeInitScript(gradleUserHome: string, pluginVersion: string): string {
    const initDir = path.join(gradleUserHome, 'init.d');
    fs.mkdirSync(initDir, { recursive: true });

    const initScriptPath = path.join(initDir, INIT_SCRIPT_NAME);
    fs.writeFileSync(initScriptPath, generateInitScript(pluginVersion), 'utf-8');
    return initScriptPath;
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
        console.log(tl.loc('Info_AutoDiscoveredBuildFiles', found.join(', ')));
    }
    return found;
}

function getDefaultGradleUserHome(): string {
    return process.env['GRADLE_USER_HOME'] || path.join(os.homedir(), '.gradle');
}

run();
