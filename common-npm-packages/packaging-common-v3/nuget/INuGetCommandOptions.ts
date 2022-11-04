import {NuGetEnvironmentSettings} from "./NuGetToolRunner";

export interface INuGetCommandOptions {
    /** settings used to initialize the environment NuGet.exe is invoked in */
    environment: NuGetEnvironmentSettings;
    /** full path to NuGet.exe */
    nuGetPath: string;
    /** path to the NuGet config file. Passed as the -ConfigFile argument. */
    configFile: string;
}

export default INuGetCommandOptions;
