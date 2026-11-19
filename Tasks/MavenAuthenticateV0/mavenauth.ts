import tl = require('azure-pipelines-task-lib/task');
import util = require('./mavenutils');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import { IssueSource } from 'azure-pipelines-task-lib/internal';

#if WIF
import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";
#endif

const M2FolderName: string = ".m2";
const SettingsXmlName: string = "settings.xml";
const backupSettingsXmlName: string = "_settings.xml";

tl.setResourcePath(path.join(__dirname, 'task.json'));

function tryChmodSync(targetPath: string, mode: number): void {
    try {
        fs.chmodSync(targetPath, mode);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : err;

        tl.warning(
            tl.loc("Warning_ChmodFailed", targetPath, mode.toString(8), errorMessage),
            IssueSource.CustomerScript
        );
    }
}

function isSamePath(first: string, second: string, caseInsensitive: boolean): boolean {
    const a = path.resolve(first);
    const b = path.resolve(second);
    return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// Identify directories by device and inode so that aliases realpath can't see through
// (bind mounts, case variants, subst drives, 8.3 names) still match.
function getDirectoryId(directory: string): string | undefined {
    try {
        const stats = fs.statSync(directory, { bigint: true });
        return stats.ino ? `${stats.dev}:${stats.ino}` : undefined;
    } catch {
        return undefined;
    }
}

// Agent folders that don't exist are skipped: nothing can be nested inside them.
function getAgentFolders(): { name: string; realPath: string; id?: string }[] {
    const folders: { name: string; realPath: string; id?: string }[] = [];
    for (const variableName of ['Agent.WorkFolder', 'Agent.TempDirectory', 'Agent.ToolsDirectory', 'Agent.HomeDirectory']) {
        const folder = tl.getVariable(variableName);
        if (!folder) {
            continue;
        }

        try {
            const realPath = fs.realpathSync(folder);
            folders.push({ name: folder, realPath, id: getDirectoryId(realPath) });
        } catch {
            continue;
        }
    }

    return folders;
}

// Pipeline variables, including queue-time overrides, are applied to the task's environment,
// so HOME/USERPROFILE can't be trusted to locate the credential file. Use the OS account's home instead.
function getUserHomeDirectory(isWindows: boolean): { path: string; isFallback: boolean } {
    const homeEnvVarName = isWindows ? "USERPROFILE" : "HOME";
    const homeEnvVarValue = process.env[homeEnvVarName];

    let accountHome: string | undefined;
    try {
        accountHome = os.userInfo().homedir;
    } catch (err) {
        tl.warning(
            tl.loc("Warning_AccountHomeLookupFailed", (err && err.message) ? err.message : err),
            IssueSource.CustomerScript
        );
    }

    if (!accountHome) {
        return { path: getFallbackHomeDirectory(isWindows), isFallback: true };
    }

    // Match the JDK's user.home fallback (JDK-8282102): a home shorter than 2 characters, such as "/", is unusable.
    if (accountHome.length < 2) {
        tl.warning(tl.loc("Warning_AccountHomeUnusable", accountHome), IssueSource.CustomerScript);
        return { path: getFallbackHomeDirectory(isWindows), isFallback: true };
    }

    if (homeEnvVarValue && !isSamePath(homeEnvVarValue, accountHome, isWindows)) {
        tl.warning(
            tl.loc("Warning_HomeEnvVarIgnored", homeEnvVarName, accountHome),
            IssueSource.CustomerScript
        );
    }

    return { path: accountHome, isFallback: false };
}

// The fallback comes from HOME/USERPROFILE, which pipeline variables can override,
// so only accept a directory that can't expose the credentials to other users or published artifacts.
function getFallbackHomeDirectory(isWindows: boolean): string {
    const home = os.homedir();

    if (!home || !path.isAbsolute(home)) {
        throw new Error(tl.loc("Error_FallbackHomeNotAbsolute", home));
    }

    let realHome: string;
    let stats: fs.Stats;
    try {
        realHome = fs.realpathSync(home);
        stats = fs.statSync(realHome);
    } catch (err) {
        throw new Error(tl.loc("Error_FallbackHomeUnreadable", home, (err && err.message) ? err.message : err));
    }

    const agentFolders = getAgentFolders();
    for (let current = realHome; ; current = path.dirname(current)) {
        const currentId = getDirectoryId(current);
        const agentFolder = agentFolders.find(folder => folder.id && currentId
            ? folder.id === currentId
            : isSamePath(current, folder.realPath, isWindows));
        if (agentFolder) {
            throw new Error(tl.loc("Error_FallbackHomeInAgentFolder", home, agentFolder.name));
        }

        if (path.dirname(current) === current) {
            break;
        }
    }

    if (!isWindows) {
        if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) {
            throw new Error(tl.loc("Error_FallbackHomeNotOwned", home));
        }

        if ((stats.mode & 0o022) !== 0) {
            throw new Error(tl.loc("Error_FallbackHomeWritableByOthers", home));
        }

        // JDK 18 and earlier ignore HOME when the account has no usable home, so Maven may not read this file.
        const settingsXmlPath = path.join(home, M2FolderName, SettingsXmlName);
        tl.warning(tl.loc("Warning_FallbackHomeJavaCompat", settingsXmlPath, settingsXmlPath), IssueSource.CustomerScript);
    }

    return realHome;
}

// A symlinked .m2 or settings file under the fallback home could redirect the credentials
// into the workspace or another shared location, so refuse to follow one.
function rejectSymlinks(paths: string[]): void {
    for (const candidate of paths) {
        let stats: fs.Stats;
        try {
            stats = fs.lstatSync(candidate);
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                continue;
            }
            throw new Error(tl.loc("Error_FallbackHomeUnreadable", candidate, (err && err.message) ? err.message : err));
        }

        if (stats.isSymbolicLink()) {
            throw new Error(tl.loc("Error_FallbackHomeSymlink", candidate));
        }
    }
}

async function run(): Promise<void> {
    let internalFeedServerElements: any[] = [];
    let externalServiceEndpointsServerElements: any[] = [];
    let federatedFeedAuthSuccessCount: number = 0;
    try {
        const isWindows = !!tl.osType().match(/^Win/);
        const restrictPermissions = !isWindows;
        const userHome = getUserHomeDirectory(isWindows);
        const userM2FolderPath: string = path.join(userHome.path, M2FolderName);
        const userSettingsXmlPath: string = path.join(userM2FolderPath, SettingsXmlName);
        const backupSettingsXmlPath: string = path.join(userM2FolderPath, backupSettingsXmlName);

        if (userHome.isFallback) {
            rejectSymlinks([userM2FolderPath, userSettingsXmlPath, backupSettingsXmlPath]);
        }

        if (!tl.exist(userM2FolderPath)) {
            tl.debug(tl.loc("Info_M2FolderDoesntExist", userM2FolderPath));
            tl.mkdirP(userM2FolderPath);
            if (restrictPermissions) {
                tryChmodSync(userM2FolderPath, 0o700);
            }
        }

        let settingsJson: any;
        
        tl.setTaskVariable('userM2SettingsXmlPath', userSettingsXmlPath);

        if (tl.exist(userSettingsXmlPath)) {
            tl.debug(tl.loc("Info_SettingsXmlRead", userSettingsXmlPath));
            if (!tl.getVariable('FIRST_RUN_SETTINGS_XML_EXISTS_PATH') && !tl.exist(backupSettingsXmlPath)) {
                if (restrictPermissions) {
                    try {
                        const originalSettingsXmlMode = fs.statSync(userSettingsXmlPath).mode & 0o777;
                        tl.setTaskVariable("originalUserM2SettingsFileMode", originalSettingsXmlMode.toString(8));
                    } catch (err) {
                        tl.warning(tl.loc("Warning_StatFailed", userSettingsXmlPath, (err && err.message) ? err.message : err), IssueSource.CustomerScript);
                    }
                }
                tl.cp(userSettingsXmlPath, backupSettingsXmlPath);
                tl.setTaskVariable("backupUserM2SettingsFilePath", backupSettingsXmlPath);
                if (restrictPermissions) {
                    tryChmodSync(backupSettingsXmlPath, 0o600);
                }
            }
            if (restrictPermissions) {
                tryChmodSync(userSettingsXmlPath, 0o600);
            }
            settingsJson = await util.readXmlFileAsJson(userSettingsXmlPath);
        }
        else {
            tl.debug(tl.loc("Info_CreatingSettingsXml", userSettingsXmlPath));
            tl.setVariable('FIRST_RUN_SETTINGS_XML_EXISTS_PATH', userSettingsXmlPath);
        }

#if WIF
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        const feedIdNames = tl.getDelimitedInput("artifactsFeeds", ',');

        if (entraWifServiceConnectionName) {

            if (feedIdNames.length === 0) {
                tl.warning(tl.loc("Warning_NoEndpointsToAuth"));
                return;
            }
            
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName));
            let token = await getFederatedWorkloadIdentityCredentials(entraWifServiceConnectionName);
            
            if (token) {

                for (let feedName of feedIdNames) {
                    const wifServerElement = {
                        id: feedName,
                        username: entraWifServiceConnectionName,
                        password: token
                    };
    
                    settingsJson = util.addRepositoryEntryToSettingsJson(settingsJson, wifServerElement);
                    federatedFeedAuthSuccessCount++;
                    tl.writeExternalOutput(
                        tl.loc("Info_SuccessAddingFederatedFeedAuth", feedName) + os.EOL,
                        { source: 'remote' }
                    );
                }

                tl.debug(tl.loc("Info_WritingToSettingsXml"));
                await util.jsonToXmlConverter(userSettingsXmlPath, settingsJson);

            }
            else {
                tl.warning(tl.loc("Warning_TokenNotGenerated"));
            }
            return;
        }
#endif

        internalFeedServerElements = util.getInternalFeedsServerElements("artifactsFeeds");
        externalServiceEndpointsServerElements = util.getExternalServiceEndpointsServerElements("mavenServiceConnections");
        const newServerElements = internalFeedServerElements.concat(externalServiceEndpointsServerElements);

        if(newServerElements.length === 0) {
            tl.warning(tl.loc("Warning_NoEndpointsToAuth"));
            return;
        }

        for (let serverElement of newServerElements) {
            settingsJson = util.addRepositoryEntryToSettingsJson(settingsJson, serverElement);
        };

        tl.debug(tl.loc("Info_WritingToSettingsXml"));
        await util.jsonToXmlConverter(userSettingsXmlPath, settingsJson);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    finally {
        emitTelemetry("Packaging", "MavenAuthenticate", {
            "InternalFeedAuthCount": internalFeedServerElements.length,
            "ExternalRepoAuthCount": externalServiceEndpointsServerElements.length,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
        });
    }
}

run();
