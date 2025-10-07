import * as TaskManifestData from "./task.json";

export class Utils {

    public static GenerateUserAgent(): string {

        const taskVersion: string = `${TaskManifestData.version.Major}.${TaskManifestData.version.Minor}.${TaskManifestData.version.Patch}`;

        const userAgent: string = `AzurePipelines.AzureAppConfiguration.Import/${taskVersion}`;

        // webClient.WebRequest will load environment variable as user-agent.
        return userAgent;
    }

    // Duck typing a workaround for instanceof, since we use the app configuration file provider that is bundled in UMD format 
    // it is not possible to use instanceof as it will always return false this is cause UMD defines it own instance of the Argument error class and Parse error class.
    // As a workaround we check if the constructor name is the same as the class name and property message is defined
    public static IsInstanceOf(error: Error, className: string): error is Error {
    
        return error && error.constructor.name == className && 'message' in error;
    }
}