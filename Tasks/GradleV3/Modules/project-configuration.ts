import * as fs from 'fs';
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

/**
 * Check to determine if project multi module or not
 * @param {string} wrapperScript - The `gradlew` script to execute
 * @returns {boolean} `true` if project is multi module, otherwise `false`
 */
export function isMultiModuleProject(wrapperScript: string): boolean {
    const gradleBuild: ToolRunner = tl.tool(wrapperScript);
    gradleBuild.arg('properties');
    gradleBuild.line(tl.getInput('options', false));

    const data: string = gradleBuild.execSync().stdout;
    if (typeof data !== 'undefined' && data) {
        const regex: RegExp = new RegExp('subprojects: .*');
        const subProjects: RegExpExecArray = regex.exec(data);
        tl.debug('Data: ' + subProjects);

        if (typeof subProjects !== 'undefined' && subProjects && subProjects.length > 0) {
            tl.debug('Sub Projects info: ' + subProjects.toString());
            return (subProjects.join(',').toLowerCase() !== 'subprojects: []');
        }
    }
    return false;
}

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
