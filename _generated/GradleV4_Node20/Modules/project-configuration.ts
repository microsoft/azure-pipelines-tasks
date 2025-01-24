import * as fs from 'fs';
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';


/**
 * Configure wrapper script:
 * - For Windows - set `*.bat` extension
 * - For Linux/macOS - set script as executable
 * @param {string} wrapperScript - Relative path from the repository root to the Gradle Wrapper script.
 * @returns {string} path to the wrapper script
 */
export function configureWrapperScript(wrapperScript: string): string {
    let script: string = wrapperScript;
    const isWindows: RegExpMatchArray = os.type().match(/^Win/);

    if (isWindows) {
        // append .bat extension name on Windows platform
        if (!script.endsWith('bat')) {
            tl.debug('Append .bat extension name to gradlew script.');
            script += '.bat';
        }
    }

    if (fs.existsSync(script)) {
        try {
            // Make sure the wrapper script is executable
            fs.accessSync(script, fs.constants.X_OK)
        } catch (err) {
            // If not, show warning and chmodding the gradlew file to make it executable
            tl.warning(tl.loc('chmodGradlew'));
            fs.chmodSync(script, '755');
        }
    }
    return script;
}
