import * as fileSystem from "fs";
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { VersionInfo } from "./models";
import * as tl from 'vsts-task-lib/task';

export class globalJsonFetcher {

    private workingDirectory: string;
    private versionFetcher: DotNetCoreVersionFetcher = new DotNetCoreVersionFetcher();
    /**
     * The global json fetcher provider functionality to extract the version information from all global json in the working directory.
     * @param workingDirectory 
     */
    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;
    }

    /**
     * Get all version information from all global.json starting from the working directory.
     * @param packageType define if you want install the sdk or the runtime.
     */
    public async Get(packageType: string): Promise<VersionInfo[]>{
        var versionInformation: VersionInfo[] = new Array<VersionInfo>();
        for (let index = 0; index < this.getVersionStrings().length; index++) {
            const version = this.getVersionStrings()[index];
            // TODO: find out if include preview versions do anything wrong here.
            var versionInfo = await this.versionFetcher.getVersionInfo(version, packageType, true); 
            versionInformation.push(versionInfo);
        }
        return versionInformation
            .sort((a,b) => a.getVersion().localeCompare(b.getVersion()));        
    }

    private getVersionStrings(): string[]{
        let filePathsToGlobalJson = tl.findMatch(this.workingDirectory, "**/*global.json");
        if (filePathsToGlobalJson == null || filePathsToGlobalJson.length == 0) {
            throw tl.loc("FailedToFindGlobalJson");
        }
        return filePathsToGlobalJson.map(path => {
            return this.readGlobalJson(path).sdk.version;
        });
    }

    private readGlobalJson(path: string): GlobalJson {
        let globalJson: GlobalJson | null = null;
        console.log(tl.loc("GlobalJsonFound", path));
        try {
            globalJson = (JSON.parse(fileSystem.readFileSync(path).toString())) as { sdk: { version: string } };
        } catch (error) {
            throw tl.loc("FailedToReadGlobalJson", path);
        }
        if (globalJson == null || globalJson.sdk == null || globalJson.sdk.version == null) {
            throw tl.loc("FailedToReadGlobalJson", path);
        }
        return globalJson;        
    }

}

export class GlobalJson {
    public sdk: { version: string };
}