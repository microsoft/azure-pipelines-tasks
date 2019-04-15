import * as tl from "azure-pipelines-task-lib/task";

export class NuGetConfigHelper2 {
    tempNugetConfigPath = NuGetConfigHelper2.getTempNuGetConfigBasePath() + "\\NuGet\\tempNuGet_.config";
    
    setAuthForSourcesInTempNuGetConfig() {
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