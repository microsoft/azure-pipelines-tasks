import * as TaskManifestData from "./task.json";
import * as os from "os";

export class Utils {

    public static GenerateUserAgent(): string {
        const taskVersion: string = `${TaskManifestData.version.Major}.${TaskManifestData.version.Minor}.${TaskManifestData.version.Patch}`;
        const userAgent: string = `AzurePipelines.AzureAppConfiguration.Snapshot/${taskVersion} Node/${process["version"]} OS/(${os.arch()}-${os.type()}-${os.release()})`;
        
        return userAgent;
    }
}