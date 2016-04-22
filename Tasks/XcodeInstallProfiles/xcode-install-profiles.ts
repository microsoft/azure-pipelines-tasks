/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/glob.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />

import taskLibrary = require("vsts-task-lib/task");
import path = require("path");
import Q = require("q");
var execSync = require("child_process").execSync;
var installPromise;

var profileInstallFolder = taskLibrary.getInput("installDirectory", false);
if (!profileInstallFolder) {
    profileInstallFolder = path.join(process.env['HOME'], 'Library', 'MobileDevice', 'Provisioning Profiles');
    taskLibrary.mkdirP(profileInstallFolder);
}

var installCert = taskLibrary.getPathInput("signingCertificate", false);
var installKeychain = taskLibrary.getInput("keychainName", false);
var shouldUnlockKeychain = taskLibrary.getBoolInput("shouldUnlockKeychain", false);
var keychainPassword;
var certificatePassword;
installPromise = Q([taskLibrary.getInput("provisionFile", true)]);

installPromise = installPromise.then((provisionFileList: string[]) => {
    console.log(provisionFileList);
    var installingProvisionsPromise: Q.Promise<any> = Q(null);
    for (var i = 0; i < provisionFileList.length; i++) {
        var provisionFile = provisionFileList[i];
        console.log("Attemting install of profile: " + provisionFile);
        installingProvisionsPromise = installingProvisionsPromise.then(() => {
            return installProvisioningProfile(provisionFile);
        });
    }

    return installingProvisionsPromise;
});

if (installCert) {
    certificatePassword = taskLibrary.getInput("certificatePassword", true);

    installPromise = installPromise.then(() => {
        var securityCommand = taskLibrary.which("security", true);
        var securityCommandArgs = ["import"];

        securityCommandArgs.push(installCert);

        if (installKeychain) {
            securityCommandArgs.push("-k");
            securityCommandArgs.push(installKeychain);
        }

        securityCommandArgs.push("-P");
        securityCommandArgs.push(certificatePassword);

        var codeSign = taskLibrary.which("codesign", false);
        if (codeSign) {
            securityCommandArgs.push("-T");
            securityCommandArgs.push(codeSign);
        }
        
        return runCommand(securityCommand, securityCommandArgs);
    });
}

if (shouldUnlockKeychain) {
    if (!keychainPassword) {
        keychainPassword = taskLibrary.getInput("keychainPassword", true);
    }
    
    installPromise = installPromise.then(() => {
        var securityCommand = taskLibrary.which("security", true);
        var securityCommandArgs = ["unlock-keychain"];
        
        securityCommandArgs.push("-p");
        securityCommandArgs.push(keychainPassword);
        
        if (installKeychain) {
            securityCommandArgs.push(installKeychain);
        }
        
        return runCommand(securityCommand, securityCommandArgs);
    });
}

installPromise.fail((err: any) => {
    taskLibrary.error("task Failed");
    taskLibrary.debug(err);
    taskLibrary.setResult(taskLibrary.TaskResult.Failed, "Task Failed");
}).done(() => {
    taskLibrary.debug("task Completed");
    taskLibrary.setResult(taskLibrary.TaskResult.Succeeded, "Task Succeeded");
})

function installProvisioningProfile(profileFile: string): Q.Promise<void> {
    var getUuidCommand = `grep -aA1 UUID ${profileFile} | grep -o "[-A-Z0-9]\\{36\\}"`;
    return Q(null).then(() => {
        var grepResult: string = execSync(`grep -aA1 UUID "${profileFile}"`).toString();
        console.log("Grep Result: " + grepResult);
        var Uuid = grepResult.match(/[-0-9a-zA-Z]{36}/g)[0];
        taskLibrary.debug("Found UUID " + Uuid + ". Installing...");
        return runCommand("cp", [profileFile, path.join(profileInstallFolder, `${Uuid}.mobileprovision`)]).fail((reason: any) => {
            taskLibrary.debug("Failed to install profile " + profileFile);
            taskLibrary.error(reason);
        })
    })
}

function runCommand(commandString: string, args?: any): Q.Promise<any> {
    taskLibrary.debug("Setting up command " + commandString);
    if (typeof args == "string") {
        args = [args];
    }

    var command = taskLibrary.createToolRunner(commandString);

    if (args) {
        args.forEach((arg: string) => {
            taskLibrary.debug("Appending argument: " + arg);
            command.arg(arg);
        });
    }

    return command.exec().fail((err: any) => {
        console.error(err.message);
        taskLibrary.debug('taskRunner fail');
    });
}