import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

const findAndroidTool = (tool: string): string => {
    const androidHome = tl.getVariable('ANDROID_HOME');
    if (!androidHome) {
        throw new Error(tl.loc('AndroidHomeNotSet'));
    }

    // add * in search as on Windows the tool may end with ".exe" or ".bat"
    const toolsList = tl.findMatch(tl.resolve(androidHome, 'build-tools'), tool + '*', null, { matchBase: true });

    if (!toolsList || toolsList.length === 0) {
        throw new Error(tl.loc('CouldNotFindToolInAndroidHome', tool, androidHome));
    }

    return toolsList[0];
};

/*
Signing the specified file with apksigner.  Move the current file to fn.unsigned, and
place the signed file at the same location fn
*/
const apksigning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to sign');

    let apksigner = tl.getInput('apksignerLocation', false);

    // if the tool path is not set, let's find one (anyone) from the SDK folder
    if (!apksigner) {
        apksigner = findAndroidTool('apksigner');
    }

    const apksignerRunner = tl.tool(apksigner);

    // Get keystore file path for signing
    const keystoreFile = tl.getTaskVariable('KEYSTORE_FILE_PATH');

    // Get keystore alias
    const keystoreAlias = tl.getInput('keystoreAlias', true);

    const keystorePass = tl.getInput('keystorePass', false);

    const keyPass = tl.getInput('keyPass', false);

    const apksignerArguments = tl.getInput('apksignerArguments', false);

    apksignerRunner.arg(['sign', '--ks', keystoreFile]);

    if (keystorePass) {
        apksignerRunner.arg(['--ks-pass', 'pass:' + keystorePass]);
    }

    if (keystoreAlias) {
        apksignerRunner.arg(['--ks-key-alias', keystoreAlias]);
    }

    if (keyPass) {
        apksignerRunner.arg(['--key-pass', 'pass:' + keyPass]);
    }

    if (apksignerArguments) {
        apksignerRunner.line(apksignerArguments);
    }

    apksignerRunner.arg([fn]);

    return apksignerRunner.exec(null);
};

/*
Zipaligning apk
*/
const zipaligning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to zipalign');

    let zipaligner = tl.getInput('zipalignLocation', false);

    // if the tool path is not set, let's find one (anyone) from the SDK folder
    if (!zipaligner) {
        zipaligner = findAndroidTool('zipalign');
    }

    const zipalignRunner = tl.tool(zipaligner);

    // alignment must be 4 or play store will reject, hard code this to avoid user errors
    zipalignRunner.arg(['-v', '4']);

    const unalignedFn = fn + '.unaligned';
    const success = tl.mv(fn, unalignedFn, '-f', false);

    zipalignRunner.arg([unalignedFn, fn]);
    return zipalignRunner.exec(null);
};

async function run() {
    try {
        // Configure localization
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get files to be signed
        const filesPattern: string = tl.getInput('files', true);

        // Signing the APK?
        const apksign: boolean = tl.getBoolInput('apksign');

        // Zipaligning the APK?
        const zipalign: boolean = tl.getBoolInput('zipalign');

        // Resolve files for the specified value or pattern
        const filesToSign: string[] = tl.findMatch(null, filesPattern);

        // Fail if no matching files were found
        if (!filesToSign || filesToSign.length === 0) {
            throw new Error(tl.loc('NoMatchingFiles', filesPattern));
        }

        for (const file of filesToSign) {
            if (zipalign) {
                await zipaligning(file);
            }

            if (apksign) {
                await apksigning(file);
            }
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();