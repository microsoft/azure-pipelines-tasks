import path = require('path');
import * as tl from 'azure-pipelines-task-lib/task';

/*
Signing the specified file.  Move the current file to fn.unsigned, and
place the signed file at the same location fn
*/
var jarsigning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to sign');

    var jarsigner = tl.which("jarsigner", false);
    if (!jarsigner) {
        var java_home = tl.getVariable('JAVA_HOME');
        if (!java_home) {
            throw tl.loc('JavaHomeNotSet');
        }

        jarsigner = tl.resolve(java_home, 'bin', 'jarsigner');
    }

    var jarsignerRunner = tl.tool(jarsigner);

    // Get keystore file path for signing
    var keystoreFile = tl.getTaskVariable('KEYSTORE_FILE_PATH');

    // Get keystore alias
    var keystoreAlias = tl.getInput('keystoreAlias', true);

    var keystorePass = tl.getInput('keystorePass', false);

    var keyPass = tl.getInput('keyPass', false);

    var jarsignerArguments = tl.getInput('jarsignerArguments', false);

    jarsignerRunner.arg(['-keystore', keystoreFile]);

    if (keystorePass) {
        jarsignerRunner.arg(['-storepass', keystorePass]);
    }

    if (keyPass) {
        jarsignerRunner.arg(['-keypass', keyPass]);
    }

    if (jarsignerArguments) {
        jarsignerRunner.line(jarsignerArguments);
    }

    var unsignedFn = fn + ".unsigned";
    var success = tl.mv(fn, unsignedFn, '-f', false);

    jarsignerRunner.arg(['-signedjar', fn, unsignedFn, keystoreAlias]);

    return jarsignerRunner.exec(null);
}

/*
Zipaligning apk
*/
var zipaligning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to zipalign');

    var zipaligner = tl.getInput('zipalignLocation', false);

    // if the tool path is not set, let's find one (anyone) from the SDK folder
    if (!zipaligner) {

        var android_home = tl.getVariable('ANDROID_HOME');
        if (!android_home) {
            throw tl.loc('AndroidHomeNotSet');
        }

        var zipalignToolsList = tl.findMatch(tl.resolve(android_home, 'build-tools'), "zipalign*", null, { matchBase: true });

        if (!zipalignToolsList || zipalignToolsList.length === 0) {
            throw tl.loc('CouldNotFindZipalignInAndroidHome', android_home);
        }

        zipaligner = zipalignToolsList[0];
    }

    if (!zipaligner) {
        throw tl.loc('CouldNotFindZipalign');
    }

    var zipalignRunner = tl.tool(zipaligner);

    // alignment must be 4 or play store will reject, hard code this to avoid user errors
    zipalignRunner.arg(["-v", "4"]);

    var unalignedFn = fn + ".unaligned";
    var success = tl.mv(fn, unalignedFn, '-f', false);

    zipalignRunner.arg([unalignedFn, fn]);
    return zipalignRunner.exec(null);
}

async function run() {
    try {
        // Configure localization
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get files to be signed 
        let filesPattern: string = tl.getInput('files', true);

        // Signing the APK?
        let jarsign: boolean = tl.getBoolInput('jarsign');

        // Zipaligning the APK?
        let zipalign: boolean = tl.getBoolInput('zipalign');

        // Resolve files for the specified value or pattern
        let filesToSign: string[] = tl.findMatch(null, filesPattern);

        // Fail if no matching files were found
        if (!filesToSign || filesToSign.length === 0) {
            throw tl.loc('NoMatchingFiles', filesPattern);
        }

        for (let file of filesToSign) {
            if (jarsign) {
                await jarsigning(file);
            }

            if (zipalign) {
                await zipaligning(file);
            }
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();

