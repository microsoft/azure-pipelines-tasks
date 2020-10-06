import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';
import os = require('os');
import path = require('path');
import semver = require('semver');
import coerce = require('semver/functions/coerce');
import SemVer = require('semver/classes/semver');

tl.setResourcePath(path.join(__dirname, 'lib.json'));

const isWindows: boolean = os.platform() === 'win32';
const jdkKeySign: string = 'JavaSoft';
const unsupportedVersions: string[] = [ '9', '10'];

/**
 * Parses JDK version from registry key string
 * @param key JDK related registry key
 */
function parseJavaVersionFromRegKey(key: string): string {
    const rawVersion: string = key.substring(key.lastIndexOf('\\'));
    const coerced: SemVer = coerce(rawVersion);
    return coerced ? coerced.version : null;
}

/**
 * Comparer method to pass to Array.sort(). Allows to compare JDK related keys versions in descending order.
 * @param a First JDK related registry key
 * @param b Second JDK related registry key
 */
function javaRegistryKeysComparer(a: string, b: string): number {
    const aVersion: string = parseJavaVersionFromRegKey(a);
    const bVersion: string = parseJavaVersionFromRegKey(b);
    return semver.rcompare(aVersion, bVersion);
}

/**
 * Returns list of keys related to specified JDK version sorted from newer to older.
 * @param jdkVersion JDK version. Should have short format (6, 7, 11 etc. instead of 1.6, 1.7, 1.11)
 */
function getJavaRegistryKeys(jdkShortVersion: string): string[] {
    tl.debug(tl.loc('SearchingRegistryKeys', jdkShortVersion));
    let reg = tl.tool('reg');
    // JDK registry key was changed since JDK 9. To get more details, see https://docs.oracle.com/javase/9/install/installation-jdk-and-jre-microsoft-windows-platforms.htm#GUID-47C269A3-5220-412F-9E31-4B8C37A82BFB
    if (coerce(jdkShortVersion).major >= 9) {
        reg.arg(['query', 'HKLM\\SOFTWARE\\JavaSoft\\JDK\\', '/f', `${jdkShortVersion}`, '/k']);
    } else {
        reg.arg(['query', 'HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\', '/f', `1.${jdkShortVersion}`, '/k']);
    }

    let result: trm.IExecSyncResult = reg.execSync(<trm.IExecOptions>{
        ignoreReturnCode: true
    });

    let registryKeys: string[] = [];
    if (result && result.code === 0 && result.stdout) {
        //Parse JDK related keys from stdout.
        //Filter only keys containing 'JavaSoft'
        registryKeys = result.stdout.split(os.EOL).filter(key => key.includes(jdkKeySign) && parseJavaVersionFromRegKey(key));
        //Sort by key string descending from newer versions to older.
        registryKeys = registryKeys.sort(javaRegistryKeysComparer);
    }
    tl.debug(tl.loc('RegistryKeysFound', registryKeys.length));

    return registryKeys;
}

/**
 * Reads value of JAVA_HOME from registry. Returns null if not found.
 * @param jdkVersion JDK version. Should have short format (6, 7, 11 etc. instead of 1.6, 1.7, 1.11)
 * @param arch Architecture (should be either x64 or x86).
 */
function readJavaHomeFromRegistry(jdkShortVersion: string, arch: string): string {
    let javaHome = null;

    if (isWindows) {
        let reg = tl.tool('reg');

        const javaRegistryKeys: string[] = getJavaRegistryKeys(jdkShortVersion);
        if (javaRegistryKeys.length > 0) {
            reg.arg(['query', `${javaRegistryKeys[0].replace('HKEY_LOCAL_MACHINE', 'HKLM')}`, '/v', 'JavaHome']);

            if (arch.toLowerCase() === "x86") {
                reg.arg("/reg:32");
            } else {
                reg.arg("/reg:64");
            }

            let result = reg.execSync(<trm.IExecOptions>{
                ignoreReturnCode: true
            });

            if (result && result.code === 0 && result.stdout) {
                let regSzIdx = result.stdout.indexOf("REG_SZ");
                if (regSzIdx > -1) {
                    let output: string[] = result.stdout.split("REG_SZ");
                    if (output.length === 2) {
                        javaHome = output[1].trim(); // value is what comes after
                        tl.debug("JAVA_HOME: " + javaHome);
                    }
                }
            }
        }
    }

    return javaHome;
}

/**
 * Returns short form of JDK version (e.g. 1.6.0 => 6.0).
 * @param jdkVersion 
 */
function getShortJavaVersion(jdkVersion: string): string {
    if (jdkVersion.startsWith('1.')) {
        return jdkVersion.slice(2);
    }
    return jdkVersion;
}

export function findJavaHome(jdkVersion: string, jdkArch: string): string {
    tl.debug(tl.loc('LocateJVMBasedOnVersionAndArch', jdkVersion, jdkArch));

    const jdkShortVersion: string = getShortJavaVersion(jdkVersion);
    const jdkMajorVersion: number = coerce(jdkShortVersion).major;
    // jdkArchitecture is either x64 or x86
    // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
    var envName = "JAVA_HOME_" + jdkMajorVersion + "_" + jdkArch.toUpperCase();
    let discoveredJavaHome = tl.getVariable(envName);
    if (!discoveredJavaHome) {
        if (isWindows) {
            discoveredJavaHome = readJavaHomeFromRegistry(jdkShortVersion, jdkArch);
        }

        if (!discoveredJavaHome) {
            if (unsupportedVersions.indexOf(jdkMajorVersion.toString()) >= 0) {
                // if jdk version is in unsupported versions list, warn and switch to 1.11 to avoid breaking builds
                tl.warning(tl.loc('UnsupportedJdkWarning'));
                return findJavaHome('11', jdkArch);
            } else {
                throw new Error(tl.loc('FailedToLocateSpecifiedJVM', envName));
            }
        }
    }

    return discoveredJavaHome;
}

export function publishJavaTelemetry(taskName: string, javaTelemetryData) {
    try {
        //tl.assertAgent('2.120.0'); -> we can use this when all the tasks using this common module use vsts-task-lib 2.1.0 or higher
        let agentVersion: string = tl.getVariable('Agent.Version');
        if (agentVersion && !semver.lt(agentVersion, '2.120.0') && taskName && javaTelemetryData) {
            console.log('##vso[telemetry.publish area=TaskHub;feature=' + taskName + ']' + JSON.stringify(javaTelemetryData));
        } else {
            tl.debug('Failed to publish java telemetry. Agent version 2.120.0 or higher is required.');
        }
    } catch (err) {
        tl.debug('Failed to publish java telemetry: ' + err);
    }
}