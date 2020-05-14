import tl = require("azure-pipelines-task-lib/task");

export class NuGetConfigHelper2 {
    tempNugetConfigPath = tl.getVariable("Agent.HomeDirectory") + "\\tempNuGet_.config";
    
    setAuthForSourcesInTempNuGetConfig() {
        tl.debug("setting up auth for the sources configured in the helper");
    }
    
    addSourcesToTempNuGetConfig(packageSources) {
        packageSources.forEach((source) => {
            tl.debug(`adding package source uri: ${source.feedUri}`);
        });
    }
}