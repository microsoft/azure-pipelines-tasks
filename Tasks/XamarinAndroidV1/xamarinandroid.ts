import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import * as javacommons from 'azure-pipelines-tasks-java-common/java-common';

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
        const msbuildArguments: string | null = tl.getInput('msbuildArguments');

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
            buildToolPath = await getMSBuildPath(msbuildVersion);
        }

        if (!buildToolPath) {
            throw tl.loc('MSB_BuildToolNotFound');
        }
        tl.debug('Build tool path = ' + buildToolPath);

        // Resolve files for the specified value or pattern
        const findOptions: tl.FindOptions = {
            allowBrokenSymbolicLinks: false,
            followSymbolicLinks: false,
            followSpecifiedSymbolicLink: false
        };
        const filesList: string[] = tl.findMatch('', project, findOptions);

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

/**
 * Finds the tool path for msbuild/xbuild based on specified msbuild version on Mac or Linux agent
 * @param version 
 */
async function getMSBuildPath(version: string) {
    let toolPath: string | undefined;

    if (version === '15.0' || version === 'latest') {
        let msbuildPath: string = tl.which('msbuild', false);
        if (msbuildPath) {
            // msbuild found on the agent, check version
            let msbuildVersion: number | undefined;

            let msbuildVersionCheckTool = tl.tool(msbuildPath);
            msbuildVersionCheckTool.arg(['/version', '/nologo']);
            msbuildVersionCheckTool.on('stdout', function (data: any) {
                if (data) {
                    let intData = parseInt(data.toString().trim());
                    if (intData && !isNaN(intData)) {
                        msbuildVersion = intData;
                    }
                }
            })
            await msbuildVersionCheckTool.exec();

            if (msbuildVersion) {
                // found msbuild version on the agent, check if it matches requirements
                if (msbuildVersion >= 15) {
                    toolPath = msbuildPath;
                }
            }
        }
    }

    if (!toolPath) {
        // either user selected old version of msbuild or we didn't find matching msbuild version on the agent
        // fallback to xbuild
        toolPath = tl.which('xbuild', false);

        if (!toolPath) {
            // failed to find a version of msbuild / xbuild on the agent
            throw tl.loc('MSB_BuildToolNotFound');
        }
    }

    return toolPath;
}

run();
