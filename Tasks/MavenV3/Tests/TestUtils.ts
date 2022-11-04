import * as fs from "fs";
import * as path from "path";

import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";

import { registerLocationHelpersMock } from 'azure-pipelines-tasks-packaging-common-v3/Tests/MockHelper';

export interface MavenTaskInputs {
    mavenVersionSelection?: string;
    mavenPath?: string;
    mavenPOMFile?: string;
    mavenSetM2Home?: string;
    options?: string;
    goals?: string;
    javaHomeSelection?: string;
    jdkVersion?: string;
    publishJUnitResults?: boolean;
    testResultsFiles?: string;
    mavenOpts?: string;
    checkstyleAnalysisEnabled?: boolean;
    pmdAnalysisEnabled?: boolean;
    findbugsAnalysisEnabled?: boolean;
    spotBugsAnalysisEnabled?: boolean;
    spotBugsGoal?: string;
    spotBugsMavenPluginVersion?: string;
    mavenFeedAuthenticate?: boolean;
    skipEffectivePom?: boolean;
    codeCoverageTool?: string;
    restoreOriginalPomXml?: boolean;
}

export const setInputs = (
    taskRunner: TaskMockRunner,
    inputs: MavenTaskInputs
) => {
    for (const key in inputs) {
        const value = inputs[key];
        if (value || typeof value === "boolean") { // We still want false to show up as input
            taskRunner.setInput(key, String(value));
        }
    }
};

const deleteFolderRecursive = (path): void => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            let curPath: string = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

export const getTempDir = (): string => {
    return path.join(__dirname, '_temp');
};

export function cleanTemporaryFolders(): void {
    deleteFolderRecursive(getTempDir());
}

export function createTemporaryFolders(): void {
    let testTempDir = getTempDir();
    let sqTempDir: string = path.join(testTempDir, '.sqAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

export const initializeTest = (taskRunner: TaskMockRunner): void => {
    process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://xplatalm.visualstudio.com/";

    const tempDirectory = getTempDir();
    process.env["AGENT_TEMPDIRECTORY"] = tempDirectory;
    process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
    process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";

    process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

    // Set up mocks for common packages
    registerLocationHelpersMock(taskRunner);

    // Prevent file writes
    taskRunner.registerMockExport("writefile", (file: string, data: string | Buffer, options?: string | fs.WriteFileOptions): void => {})
    taskRunner.registerMockExport("cp", (source: string, dest: string, options?: string, continueOnError?: boolean): void => {})
}
