/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import os = require('os');

var isWindows = os.type().match(/^Win/);

function readJavaHomeFromRegistry(jdkVersion: string, arch: string): string {
    let javaHome = null;

    if (isWindows) {
        let reg = tl.tool('reg');
        reg.arg(['query', `HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\${jdkVersion}`, "/v", "JavaHome"]);
        if (arch.toLowerCase() === "x86") {
            reg.arg("/reg:32");
        } else {
            reg.arg("/reg:64");
        }

        let result = reg.execSync({
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

    return javaHome;
}

export function findJavaHome(jdkVersion: string, jdkArch: string): string {
    tl.debug('Using JDK version to find and set JAVA_HOME');

    // jdkVersion should be in the form of 1.7, 1.8, or 1.10
    // jdkArchitecture is either x64 or x86
    // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
    var envName = "JAVA_HOME_" + jdkVersion.slice(2) + "_" + jdkArch.toUpperCase();
    let discoveredJavaHome = tl.getVariable(envName);
    if (!discoveredJavaHome) {
        if (isWindows) {
            discoveredJavaHome = readJavaHomeFromRegistry(jdkVersion, jdkArch);
        }

        if (!discoveredJavaHome) {
            throw new Error('Failed to find specified JDK version. Please make sure environment variable ' + envName + ' exists and is set to the location of a corresponding JDK.');
        }
    } 
    
    return discoveredJavaHome;
}
