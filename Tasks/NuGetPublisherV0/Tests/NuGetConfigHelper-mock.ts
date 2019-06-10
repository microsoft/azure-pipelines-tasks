import * as tl from "azure-pipelines-task-lib/task";

export class NuGetConfigHelper {

    tempNugetConfigPath = tl.getVariable("Agent.HomeDirectory") + "\\tempNuGet_.config";
    
    getSourcesFromConfig() {
        tl.debug("getting package sources");
        let result = [{ feedName: "mockFeedName", feedUri: "mockFeedUri" }];
        return result;
    }
    
    setSources(packageSources) {
        packageSources.forEach((source) => {
            tl.debug(`adding package source uri: ${source.feedUri}`);
        });
    }
}