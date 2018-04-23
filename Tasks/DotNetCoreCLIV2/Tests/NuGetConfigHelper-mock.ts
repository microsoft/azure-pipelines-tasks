import * as tl from "vsts-task-lib/task";

export class NuGetConfigHelper2 {
    tempNugetConfigPath = NuGetConfigHelper2.getTempNuGetConfigBasePath() + "\\NuGet\\tempNuGet_.config";
    
    setAuthForSourcesInTempNuGetConfigAsync() {
        tl.debug("setting up auth for the sources configured in the helper");
    }
    
    addSourcesToTempNuGetConfig(packageSources) {
        packageSources.forEach((source) => {
            tl.debug(`adding package source uri: ${source.feedUri}`);
        });
    }

    static getTempNuGetConfigBasePath() {
        return tl.getVariable("Agent.HomeDirectory");
    }
}