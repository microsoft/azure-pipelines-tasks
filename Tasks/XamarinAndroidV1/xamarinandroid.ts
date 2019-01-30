import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import { ToolRunner } from 'vsts-task-lib/toolrunner';
import * as msbuildHelpers from 'msbuildhelpers/msbuildhelpers';
import * as javacommons from 'java-common/java-common';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        const project: string | null = tl.getPathInput('project', true);
        const target: string | null = tl.getInput('target');
        const outputDir: string | null = tl.getInput('outputDir');
        const configuration: string | null = tl.getInput('configuration');
        const createAppPackage: boolean | null = tl.getBoolInput('createAppPackage');
        const clean: boolean | null = tl.getBoolInput('clean');
        const msbuildArguments: string| null = tl.getInput('msbuildArguments');

        // find jdk to be used during the build
        const jdkSelection: string = tl.getInput('jdkSelection') || 'JDKVersion'; // fall back to JDKVersion for older version of tasks

        let specifiedJavaHome: string | null | undefined = null;
        let javaTelemetryData: { jdkVersion: string } | null = null;

        if (jdkSelection === 'JDKVersion') {
            tl.debug('Using JDK version to find JDK path');
            const jdkVersion: string | null = tl.getInput('jdkVersion');
            const jdkArchitecture: string | null = tl.getInput('jdkArchitecture');
            javaTelemetryData = { jdkVersion };

            if (jdkVersion !== 'default') {
                specifiedJavaHome = javacommons.findJavaHome(jdkVersion, jdkArchitecture);
            }
        } else {
            tl.debug('Using path from user input to find JDK');
            specifiedJavaHome = tl.getPathInput('jdkUserInputPath', true, true);
            javaTelemetryData = { jdkVersion: "custom" };
        }
        javacommons.publishJavaTelemetry('XamarinAndroid', javaTelemetryData);

        //find build tool path to use
        let buildToolPath: string | undefined;

        const buildLocationMethod: string = tl.getInput('msbuildLocationMethod') || 'version';

        const buildToolLocation: string | null = tl.getPathInput('msbuildLocation');
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
            const msbuildVersion: string = tl.getInput('msbuildVersion');
            buildToolPath = await msbuildHelpers.getMSBuildPath(msbuildVersion);
        }

        if (!buildToolPath) {
            throw tl.loc('MSB_BuildToolNotFound');
        }
        tl.debug('Build tool path = ' + buildToolPath);

        // Resolve files for the specified value or pattern
        const filesList: string[] = tl.findMatch('', project, { followSymbolicLinks: false, followSpecifiedSymbolicLink: false });

        // Fail if no matching .csproj files were found
        if (!filesList || filesList.length === 0) {
            throw tl.loc('NoMatchingProjects', project);
        }

        for (const file of filesList) {
            try {
                // run the build for each matching project
                const buildRunner: ToolRunner = tl.tool(buildToolPath);
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
