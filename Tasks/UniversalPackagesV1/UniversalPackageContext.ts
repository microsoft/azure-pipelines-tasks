import * as tl from "azure-pipelines-task-lib";
import { IExecOptions } from "azure-pipelines-task-lib/toolrunner";
import { ILocationsApi } from "azure-devops-node-api/LocationsApi";

export enum OperationType {
    Download = "download",
    Publish = "publish"
}

export class UniversalPackageContext {
    // Input properties
    organization?: string;
    projectAndFeed: string;
    packageName: string;
    packageVersion?: string;
    versionIncrement?: string;
    adoServiceConnection?: string;
    directory: string;
    packageDescription?: string;
    command: OperationType;

    // Computed properties
    verbosity: string;

    // Auth properties
    accessToken?: string;
    toolRunnerOptions?: IExecOptions;
    authIdentityName?: string;
    authIdentityId?: string;

    // API clients
    locationApi?: ILocationsApi;

    // Feed properties
    feedName?: string;
    projectName?: string | null;
    serviceUri?: string;
    feedServiceUri?: string;

    // Tool properties
    artifactToolPath?: string;

    // Pipeline properties
    pipelineCollectionUri?: string;
    buildServiceAccountId?: string;  // GUID of the build service account

    constructor() {
        this.organization = tl.getInput("organization", false);
        this.projectAndFeed = tl.getInput("feed", true);
        this.packageName = tl.getInput("packageName", true);
        this.packageVersion = tl.getInput("packageVersion", false);
        this.versionIncrement = tl.getInput("versionIncrement", false);
        this.adoServiceConnection = tl.getInput("adoServiceConnection", false);
        this.directory = tl.getInput("directory", true);
        this.packageDescription = tl.getInput("packageDescription", false);
        this.command = tl.getInput("command", true) as OperationType;
        this.pipelineCollectionUri = tl.getVariable("System.TeamFoundationCollectionUri");
        this.buildServiceAccountId = tl.getVariable("Build.BuildServiceAccountId");

        // Set verbosity based on System.Debug: Debug for verbose output, Information for normal output
        this.verbosity = tl.getVariable("System.Debug") === "true" ? "Debug" : "Information";
    }
}
