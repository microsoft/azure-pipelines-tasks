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

installPromise = Q([taskLibrary.getInput("provisionFile", true)]);

installPromise.then((provisionFileList: string[]) => {
    console.log(provisionFileList);
    var installingProvisionsPromise: Q.Promise<any> = Q(null);
    for (var i = 0; i < provisionFileList.length; i++) {
        var provisionFile = provisionFileList[i];
        console.log("Attemting install of profile: " + provisionFile);
        installingProvisionsPromise = installingProvisionsPromise.then(() => {
            return installProvisioningProfile(provisionFile);
        })
    }

    return installingProvisionsPromise;
});

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

function installRubyGem(packageName: string, localPath?: string): Q.Promise<void> {
    taskLibrary.debug("Checking for ruby install...");
    taskLibrary.which("ruby", true);
    taskLibrary.debug("Checking for gem install...");
    taskLibrary.which("gem", true);

    taskLibrary.debug("Setting up gem install");
    var command = taskLibrary.createToolRunner("gem");
    command.arg("install");
    command.arg(packageName);

    if (localPath) {
        command.arg("--install-dir");
        command.arg(localPath);
    }

    taskLibrary.debug("Attempting to install " + packageName + " to " + (localPath ? localPath : " default cache directory (" + process.env['GEM_HOME'] + ")"));
    return command.exec().fail((err: any) => {
        console.error(err.message);
        taskLibrary.debug('taskRunner fail');
    });
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