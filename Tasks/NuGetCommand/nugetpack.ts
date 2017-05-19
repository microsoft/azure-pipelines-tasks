import * as tl from "vsts-task-lib/task";
// Remove once task lib 2.0.4 releases
global['_vsts_task_lib_loaded'] = true;
import * as nutil from "nuget-task-common/Utility";
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");
import * as path from "path";
import * as ngToolRunner from "./Common/NuGetToolRunner";
import * as packUtils from "./Common/NuGetPackUtilities";
import INuGetCommandOptions from "./Common/INuGetCommandOptions";

class PackOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public outputDir: string,
        public includeReferencedProjects: boolean,
        public version: string,
        public properties: string[],
        public verbosity: string,
        public configFile: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings
    ) { }
}

export async function run(): Promise<void> {
    nutil.setConsoleCodePage();

    let searchPattern = tl.getPathInput("searchPatternPack", true);
    let configuration = tl.getInput("configurationToPack");
    let outputDir = tl.getPathInput("outputDir");
    let versioningScheme = tl.getInput("versioningScheme");
    let includeRefProj = tl.getBoolInput("includeReferencedProjects");
    let versionEnvVar = tl.getInput("versionEnvVar");
    let majorVersion = tl.getInput("requestedMajorVersion");
    let minorVersion = tl.getInput("requestedMinorVersion");
    let patchVersion = tl.getInput("requestedPatchVersion");
    let propertiesInput = tl.getInput("buildProperties");
    let verbosity = tl.getInput("verbosityPack");
    try{
        if(versioningScheme !== "off" && includeRefProj)
        {
            tl.warning(tl.loc("Warning_AutomaticallyVersionReferencedProjects"));
        }

        let version: string = undefined;
        switch(versioningScheme)
        {
            case "off":
                break;
            case "byPrereleaseNumber":
                tl.debug(`Getting prerelease number`);

                let nowUtcString = packUtils.getUtcDateString();
                version = `${majorVersion}.${minorVersion}.${patchVersion}-CI-${nowUtcString}`;
                break;
            case "byEnvVar":
                tl.debug(`Getting version from env var: ${versionEnvVar}`);
                version = tl.getVariable(versionEnvVar);
                if(!version)
                {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoValueFoundForEnvVar"));
                    break;
                }
                break;
            case "byBuildNumber":
                tl.debug("Getting version number from build number")

                if(tl.getVariable("SYSTEM_HOSTTYPE") === "release")
                {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_AutomaticallyVersionReleases"));
                    return;
                }

                let buildNumber: string =  tl.getVariable("BUILD_BUILDNUMBER");
                tl.debug(`Build number: ${buildNumber}`);

                let versionRegex = /\d+\.\d+\.\d+(?:\.\d+)?/;
                let versionMatches = buildNumber.match(versionRegex);
                if (!versionMatches)
                {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoVersionFoundInBuildNumber"));
                    return;
                }

                if (versionMatches.length > 1)
                {
                    tl.warning(tl.loc("Warning_MoreThanOneVersionInBuildNumber"))
                }
                
                version = versionMatches[0];
                break;
        }

        tl.debug(`Version to use: ${version}`);

        if(outputDir && !tl.exist(outputDir))
        {
            tl.debug(`Creating output directory: ${outputDir}`);
            tl.mkdirP(outputDir);
        }
        
        let filesList = nutil.resolveFilterSpec(searchPattern);
        tl.debug(`Found ${filesList.length} files`);
        filesList.forEach(file => {
            tl.debug(`--File: ${file}`);
        });

        // Getting NuGet
        tl.debug('Getting NuGet');
        let nuGetPath: string = undefined;
        try {
            nuGetPath = process.env[nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR];
            if (!nuGetPath){
                nuGetPath = await nuGetGetter.getNuGet("4.0.0");
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
            return;
        }

        let props: string[] = [];
        if(configuration && configuration !== "$(BuildConfiguration)")
        {
            props.push(`Configuration=${configuration}`);
        }
        if(propertiesInput)
        {
            props = props.concat(propertiesInput.split(";"));
        }

        // TODO: Check nuget extensions path

        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: null,
            extensionsDisabled: true
        };

        let packOptions = new PackOptions(
            nuGetPath,
            outputDir,
            includeRefProj,
            version,
            props,
            verbosity,
            undefined,
            environmentSettings);

        for (const file of filesList) {
            await packAsync(file, packOptions);
        }
    } catch (err) {
        tl.error(err);
        tl.setResult(tl.TaskResult.Failed, tl.loc("Error_PackageFailure"));
    }
}

function packAsync(file: string, options: PackOptions): Q.Promise<number> {
    console.log(tl.loc("Info_AttemptingToPackFile") + file);

    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, undefined);
    nugetTool.arg("pack");
    nugetTool.arg(file);

    nugetTool.arg("-NonInteractive");

    if (options.outputDir) {
        nugetTool.arg("-OutputDirectory");
        nugetTool.arg(options.outputDir);
    }

    if (options.properties) {
        nugetTool.arg("-Properties");
        nugetTool.arg(options.properties.join(";"));
    }

    nugetTool.argIf(options.includeReferencedProjects, "-IncludeReferencedProjects")

    if (options.version) {
        nugetTool.arg("-version");
        nugetTool.arg(options.version);
    }

    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    return nugetTool.exec();
}