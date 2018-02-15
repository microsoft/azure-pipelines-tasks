import path = require('path');
import tl = require('vsts-task-lib/task');
import { ToolRunner } from 'vsts-task-lib/toolrunner';
import msbuildHelpers = require('msbuildhelpers/msbuildhelpers');
import javacommons = require('java-common/java-common');

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
        let msbuildArguments: string = tl.getInput('msbuildArguments');

        // find jdk to be used during the build
        let jdkSelection: string = tl.getInput('jdkSelection');
        if (!jdkSelection) {
            jdkSelection = 'JDKVersion'; //fallback to JDKVersion for older version of tasks
        }
        let specifiedJavaHome = null;
        let javaTelemetryData = null;

        if (jdkSelection === 'JDKVersion') {
            tl.debug('Using JDK version to find JDK path');
            let jdkVersion: string = tl.getInput('jdkVersion');
            let jdkArchitecture: string = tl.getInput('jdkArchitecture'); 
            javaTelemetryData = { "jdkVersion": jdkVersion };                       

            if (jdkVersion !== 'default') {
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
            javaTelemetryData = { "jdkVersion": "custom" };      
        }
        javacommons.publishJavaTelemetry('XamarinAndroid', javaTelemetryData);

        //find build tool path to use
        let buildToolPath: string;

        let buildLocationMethod: string = tl.getInput('msbuildLocationMethod');
        if (!buildLocationMethod) {
            buildLocationMethod = 'version';
        }

        let buildToolLocation: string = tl.getPathInput('msbuildLocation');
        if (buildToolLocation) {
            // msbuildLocation was specified, use it for back compat
            if (buildToolLocation.endsWith('xbuild') || buildToolLocation.endsWith('msbuild')) {
                buildToolPath = buildToolLocation;
            } else {
                // use xbuild for back compat if tool folder path is specified
                buildToolPath = path.join(buildToolLocation, 'xbuild');
            }
            tl.checkPath(buildToolPath, 'build tool');
        } else if (buildLocationMethod === 'version') {
            // msbuildLocation was not specified, look up by version
            let msbuildVersion: string = tl.getInput('msbuildVersion');
            buildToolPath = await msbuildHelpers.getMSBuildPath(msbuildVersion);
        }

        if (!buildToolPath) {
            throw tl.loc('MSB_BuildToolNotFound');
        }
        tl.debug('Build tool path = ' + buildToolPath);

        // Resolve files for the specified value or pattern
        let filesList: string[] = tl.findMatch(null, project, { followSymbolicLinks: false, followSpecifiedSymbolicLink: false });

        // Fail if no matching .csproj files were found
        if (!filesList || filesList.length === 0) {
            throw tl.loc('NoMatchingProjects', project);
        }

        for (let file of filesList) {
            try {
                // run the build for each matching project
                let buildRunner: ToolRunner = tl.tool(buildToolPath);
                buildRunner.arg(file);
                buildRunner.argIf(clean, '/t:Clean');
                buildRunner.argIf(target, '/t:' + target);
                buildRunner.argIf(createAppPackage, '/t:PackageForAndroid');
                if (msbuildArguments) {
                    buildRunner.line(msbuildArguments);
                }
                buildRunner.argIf(outputDir, '/p:OutputPath=' + outputDir);
                buildRunner.argIf(configuration, '/p:Configuration=' + configuration);
                buildRunner.argIf(specifiedJavaHome, '/p:JavaSdkDirectory=' + specifiedJavaHome);

                await buildRunner.exec();
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



