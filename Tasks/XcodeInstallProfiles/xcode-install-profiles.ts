/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/glob.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />

import taskLibrary = require("vsts-task-lib/task");
import path = require("path");
import Q = require("q");
var glob = Q.denodeify(require("glob"));
var execSync = require("child_process").execSync;
var gemCache;
var installPromise;

var profileInstallFolder = taskLibrary.getInput("installDirectory", false);
if (!profileInstallFolder) {
    profileInstallFolder = "~/Library/MobileDevice/Provisioning Profiles/";
}
var provisionerType = taskLibrary.getInput("provisionerType", true);
if (provisionerType == "file") {
    installPromise = Q([taskLibrary.getInput("provisionFile", true)]);
} else if (provisionerType == "devAccount") {
    // Set up environment
    gemCache = process.env['GEM_CACHE'] || process.platform == 'win32' ? path.join(process.env['APPDATA'], 'gem-cache') : path.join(process.env['HOME'], '.gem-cache');
    process.env['GEM_HOME'] = gemCache;

    // Add bin of new gem home so we don't ahve to resolve it later;
    process.env['PATH'] = process.env['PATH'] + ":" + gemCache + path.sep + "bin";

    installPromise = installRubyGem("cupertino");

    // Setup login credentials
    process.env["IOS_USERNAME"] = taskLibrary.getInput("username", true);
    process.env["IOS_PASSWORD"] = taskLibrary.getInput("password", true);

    installPromise = installPromise.then(() => {
        return runCommand("ios", "login").then(() => {
            return runCommand("ios", "profiles:download:all").then(() => {
                return glob("*.*provision*");
            });
        });
    });
}

installPromise.then((provisionFileList: string[]) => {
    var installingProvisionsPromise: Q.Promise<any> = Q(null);
    for (var i = 0; i < provisionFileList.length; i++) {
        installingProvisionsPromise = installingProvisionsPromise.then(() => {
            return installProvisioningProfile(provisionFileList[i]);
        })
    }
    
    return installingProvisionsPromise;
});

function installProvisioningProfile(profileFile: string): Q.Promise<void> {
    var getUuidCommand = `grep -aA1 UUID ${profileFile} | grep -o "[-A-Z0-9]\{36\}"`;
    return runCommand(getUuidCommand).then((Uuid: string) => {
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