import * as tl from "vsts-task-lib/task";

export class NuGetConfigHelper {

    tempNugetConfigPath = tl.getVariable("Agent.HomeDirectory") + "\\tempNuGet_.config";
    
    getSourcesFromConfig() {
        tl.debug("getting package sources");
        let result = [{ feedName: "mockFeedName", feedUri: "mockFeedUri" }];
        return result;
    }
    
    setSources(packageSources, includeAuth) {
        packageSources.forEach((source) => {
            tl.debug(`adding package source uri: ${source.feedUri}`);
        });
    }
}