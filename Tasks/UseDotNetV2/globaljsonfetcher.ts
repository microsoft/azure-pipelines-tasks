import * as fileSystem from "fs";
import * as tl from 'azure-pipelines-task-lib/task';
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { VersionInfo } from "./models";

export class globalJsonFetcher {

    private workingDirectory: string;
    private versionFetcher: DotNetCoreVersionFetcher = new DotNetCoreVersionFetcher(true);
    /**
     * The global json fetcher provider functionality to extract the version information from all global json in the working directory.
     * @param workingDirectory 
     */
    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;
    }

    /**
     * Get all version information from all global.json starting from the working directory without duplicates.     
     */
    public async GetVersions (): Promise<VersionInfo[]>{
        var versionInformation: VersionInfo[] = new Array<VersionInfo>();
        var versionStrings = this.getVersionStrings();
        for (let index = 0; index < versionStrings.length; index++) {
            const version = versionStrings[index];            
            var versionInfo = await this.versionFetcher.getVersionInfo(version, "sdk", false); 
            versionInformation.push(versionInfo);
        }
        
        return Array.from(new Set(versionInformation)); // this remove all not unique values.            
    }

    private getVersionStrings(): string[]{
        let filePathsToGlobalJson = tl.findMatch(this.workingDirectory, "**/global.json");
        if (filePathsToGlobalJson == null || filePathsToGlobalJson.length == 0) {            
            throw tl.loc("FailedToFindGlobalJson");
        }
        return filePathsToGlobalJson.map(path => {
            var content = this.readGlobalJson(path);
            if(content != null){
                return content.sdk.version;
            }
            return null;            
        })
        .filter(d => d != null); // remove all global.json that can't read
    }

    private readGlobalJson(path: string): GlobalJson | null {
        let globalJson: GlobalJson | null = null;
        console.log(tl.loc("GlobalJsonFound", path));
        try {
            globalJson = (JSON.parse(fileSystem.readFileSync(path).toString())) as { sdk: { version: string } };
        } catch (error) {
            tl.debug(error);
            tl.loc("FailedToReadGlobalJson", path); // We don't throw if a global.json is invalid. 
            return null;            
        }
        if (globalJson == null || globalJson.sdk == null || globalJson.sdk.version == null) {
            tl.loc("FailedToReadGlobalJson", path);
            return null;
        }
        return globalJson;        
    }

}

class GlobalJson {
    public sdk: { version: string };
}