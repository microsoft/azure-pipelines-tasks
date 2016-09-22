import * as tl from "vsts-task-lib/task";
import * as path from "path";

export class NuGetConfigHelper {

    tempNugetConfigPath = path.join(tl.getVariable("Agent.HomeDirectory"), "tempNuGet_.config");
    
    getSourcesFromConfig() {
        tl.debug("getting package sources");
        let result = { feedName: "mockFeedName", feedUri: "mockFeedUri" };
        return result;
    }
    
    setSources(packageSources) {
        packageSources.forEach((source) => {
            tl.debug(`adding package source uri: ${source.feedUri}`);
        });
    }
}