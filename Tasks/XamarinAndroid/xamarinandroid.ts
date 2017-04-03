import path = require('path');
import tl = require('vsts-task-lib/task');
import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        let project: string = tl.getPathInput('project', true);
        let target: string = tl.getInput('target');
        let outputDir: string = tl.getInput('outputDir');
        let configuration: string = tl.getInput('configuration');
        let createAppPackage: boolean = tl.getBoolInput('createAppPackage');
        let clean: boolean = tl.getBoolInput('clean');
        let xbuildLocation: string = tl.getPathInput('msbuildLocation');
        let msbuildArguments: string = tl.getInput('msbuildArguments');

        // find jdk to be used during the build
        let jdkSelection: string = tl.getInput('jdkSelection');
        if (!jdkSelection) {
            jdkSelection = 'JDKVersion'; //fallback to JDKVersion for older version of tasks
        }
        let specifiedJavaHome = null;

        if (jdkSelection == 'JDKVersion') {
            tl.debug('Using JDK version to find JDK path');
            let jdkVersion: string = tl.getInput('jdkVersion');
            let jdkArchitecture: string = tl.getInput('jdkArchitecture');

            if (jdkVersion != 'default') {
                // jdkVersion should be in the form of 1.7, 1.8, or 1.10
                // jdkArchitecture is either x64 or x86
                // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
                let envName: string = "JAVA_HOME_" + jdkVersion.slice(2) + "_" + jdkArchitecture.toUpperCase();
                specifiedJavaHome = tl.getVariable(envName);
                if (!specifiedJavaHome) {
                    throw tl.loc('JDKNotFound', envName);
                }
            }
        }
        else {
            tl.debug('Using path from user input to find JDK');
            let jdkUserInputPath: string = tl.getPathInput('jdkUserInputPath', true, true);
            specifiedJavaHome = jdkUserInputPath;
        }

        //find xbuild location to use
        let xbuildToolPath: string = tl.which('xbuild');
        if (xbuildLocation) {
            xbuildToolPath = path.join(xbuildLocation, 'xbuild');
            if (!tl.exist(xbuildToolPath)) {
                xbuildToolPath = path.join(xbuildLocation, 'xbuild.exe');
            }
            tl.checkPath(xbuildToolPath, 'xbuild');
        }
        if (!xbuildToolPath) {
            throw tl.loc('XbuildNotFound');
        }

        // Resolve files for the specified value or pattern
        let filesList: string[] = tl.findMatch(null, project);

        // Fail if no matching .csproj files were found
        if (!filesList || filesList.length === 0) {
            throw tl.loc('NoMatchingProjects', project);
        }

        for (let file of filesList) {
            try {
                // run the build for each matching project
                let xbuild: ToolRunner = tl.tool(xbuildToolPath);
                xbuild.arg(file);
                xbuild.argIf(clean, '/t:Clean');
                xbuild.argIf(target, '/t:' + target);
                xbuild.argIf(createAppPackage, '/t:PackageForAndroid');
                if (msbuildArguments) {
                    xbuild.line(msbuildArguments);
                }
                xbuild.argIf(outputDir, '/p:OutputPath=' + outputDir);
                xbuild.argIf(configuration, '/p:Configuration=' + configuration);
                xbuild.argIf(specifiedJavaHome, '/p:JavaSdkDirectory=' + specifiedJavaHome);

                await xbuild.exec();
            } catch (err) {
                throw tl.loc('XamarinAndroidBuildFailed', err);
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('XamarinAndroidSucceeded'));
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();



