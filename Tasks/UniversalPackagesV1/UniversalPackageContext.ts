import * as tl from "azure-pipelines-task-lib";
import { IExecOptions } from "azure-pipelines-task-lib/toolrunner";

export enum OperationType {
    Download = "download",
    Publish = "publish"
}

export class UniversalPackageContext {
    // Input properties
    organization?: string;
    projectAndFeed: string;
    packageName: string;
    packageVersion: string;
    adoServiceConnection?: string;
    directory: string;
    verbosity: string;
    packageDescription?: string;
    command: OperationType;

    // Auth properties
    accessToken?: string;
    toolRunnerOptions?: IExecOptions;

    // Feed properties
    feedName?: string;
    projectName?: string | null;
    serviceUri?: string;

    // Tool properties
    artifactToolPath?: string;

    // Pipeline properties
    pipelineCollectionUri?: string;

    constructor() {
        this.organization = tl.getInput("organization", false);
        this.projectAndFeed = tl.getInput("feed", true);
        this.packageName = tl.getInput("packageName", true);
        this.packageVersion = tl.getInput("packageVersion", true);
        this.adoServiceConnection = tl.getInput("adoServiceConnection", false);
        this.directory = tl.getInput("directory", true);
        this.verbosity = tl.getVariable("System.Debug") === "true" ? "Debug" : tl.getInput("verbosity", true);
        this.packageDescription = tl.getInput("packageDescription", false);
        this.command = tl.getInput("command", true) as OperationType;
        this.pipelineCollectionUri = tl.getVariable("System.TeamFoundationCollectionUri");
    }
}
