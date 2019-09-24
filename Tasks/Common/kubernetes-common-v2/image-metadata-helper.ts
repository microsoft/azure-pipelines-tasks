import * as tl from "azure-pipelines-task-lib/task";
import * as util from "util";
import * as yaml from 'js-yaml';

const matchPatternForImageName = new RegExp(/\:\/\/(.+?)\@/);
const matchPatternForDigest = new RegExp(/\@sha256\:(.+)/);
const matchPatternForFileArgument = new RegExp(/-f\s|-filename\s/);
const matchPatternForServerUrl = new RegExp(/https\:\/\/(.+)/);
const matchPatternForSource = new RegExp(/source:(.+)/ig);
const matchPatternForChartPath = new RegExp(/chart path:(.+)/i);
const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
const build = "build";
const hostType = tl.getVariable("System.HostType").toLowerCase();
const isBuild = hostType === build;
const deploymentTypes: string[] = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];
const workingDirectory = tl.getVariable("System.DefaultWorkingDirectory");
const branch = tl.getVariable("Build.SourceBranchName") || tl.getVariable("Build.SourceBranch");
const repositoryProvider = tl.getVariable("Build.Repository.Provider");
const repositoryUrl = tl.getVariable("Build.Repository.Uri");

// ToDo: Add UTs for public methods
export function getDeploymentMetadata(deploymentObject: any, allPods: any, deploymentStrategy: string, clusterInfo: any, manifestUrls: string[]): any {
    let imageIds: string[] = [];
    let containers = [];
    let kind: string = deploymentObject.kind;
    try {
        if (isPodEntity(kind)) {
            containers = deploymentObject.spec.containers;
        }
        else {
            containers = deploymentObject.spec.template.spec.containers;
        }

        if (containers && containers.length > 0) {
            containers.forEach(container => {
                // Filter all pods using the container names in this deployment,
                // and get the imageIds from pod status
                imageIds = getImageIdsForPodsInDeployment(container.name, allPods.items);
            });
        }
    }
    catch (e) {
        // Don't fail the task if the image ID extraction fails
        console.log("Image Ids extraction failed with exception: " + e);
    }

    let name: string = deploymentObject.metadata && deploymentObject.metadata.name ? deploymentObject.metadata.name : "";
    let relatedUrls = [getPipelineUrl()];
    let clusterUrl = getServerUrl(clusterInfo);
    if (clusterUrl) {
        relatedUrls.push(clusterUrl);
    }

    if (manifestUrls.length > 0) {
        relatedUrls.push(...manifestUrls);
    }

    const metadataDetails = {
        "Name": name,
        "Description": getDescription(),
        "RelatedUrl": relatedUrls,
        "ResourceUri": imageIds,
        "UserEmail": getUserEmail(),
        "Config": deploymentStrategy,
        "Address": getEnvironmentResourceAddress() || clusterUrl,
        "Platform": getPlatform()
    };

    return metadataDetails;
}

export function getImageIdsForPodsInDeployment(containerName: string, pods: any[]): string[] {
    // The image name in parent.spec.template.spec.containers and in pod.status.containerStatuses is not a constant, example it is redis in former, and redis:latest in latter
    // Hence filtering the pods on the basis of container name which is a constant
    let imageIds: string[] = [];
    pods.forEach(pod => {
        const podStatus = pod.status;
        podStatus.containerStatuses.forEach(status => {
            if (status.name.toLowerCase() === containerName.toLowerCase()) {
                if (status.imageID) {
                    imageIds.push(getImageResourceUrl(status.imageID));
                }
            }
        });
    });

    return imageIds;
}

export function getImageIdsForPod(pod: any): string[] {
    let imageIds: string[] = [];
    const podStatus = pod.status;
    podStatus.containerStatuses.forEach(status => {
        if (status.imageID) {
            imageIds.push(getImageResourceUrl(status.imageID));
        }
    });

    return imageIds;
}

export function getImageResourceUrl(imageId: string): string {
    const sha256Text = "@sha256:";
    const separator = "://";
    let indexOfSeparator = imageId.indexOf(separator);
    let image = indexOfSeparator >= 0 ? imageId.substr(indexOfSeparator + separator.length) : imageId;
    const digest = getImageResourceUrlParameter(imageId, matchPatternForDigest);

    let match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/);
    if (!match) {
        return "";
    }

    let registry = match[1];
    let imgNamespace = match[2];
    let repository = match[3];

    if (!imgNamespace && registry && !/[:.]/.test(registry)) {
        imgNamespace = registry;
        registry = "docker.io";
    }

    if (!imgNamespace && !registry) {
        registry = "docker.io";
        imgNamespace = "library";
    }

    registry = registry ? registry + "/" : "";
    imgNamespace = imgNamespace ? imgNamespace + "/" : "";

    return util.format("https://%s%s%s%s%s", registry, imgNamespace, repository, sha256Text, digest);
}

export function getImageResourceUrlParameter(imageId: string, matchPattern: RegExp): string {
    const imageMatch = imageId.match(matchPattern);
    if (imageMatch && imageMatch.length >= 1) {
        return imageMatch[1];
    }

    return "";
}

function getUserEmail(): string {
    const build = "build";
    const buildReason = "schedule";
    const hostType = tl.getVariable("System.HostType").toLowerCase();
    let userEmail: string = "";
    if (hostType === build && tl.getVariable("Build.Reason").toLowerCase() !== buildReason) {
        userEmail = tl.getVariable("Build.RequestedForEmail");
    }
    else {
        userEmail = tl.getVariable("Release.RequestedForEmail");
    }

    return userEmail;
}

function getDescription(): string {
    // Todo: Should we have a particular description with deployment details?
    const release = "release";
    const hostType = tl.getVariable("System.HostType").toLowerCase();
    const description: string = hostType === release ? tl.getVariable("Release.ReleaseDescription") : "";
    return description;
}

function getEnvironmentResourceAddress(): string {
    const environmentResourceName = tl.getVariable("Environment.ResourceName");
    const environmentResourceId = tl.getVariable("Environment.ResourceId");
    if (!environmentResourceName && !environmentResourceId) {
        return "";
    }

    return util.format("%s/%s", environmentResourceName, environmentResourceId);
}

function getPipelineUrl(): string {
    let pipelineUrl = "";
    if (isBuild) {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_build/results?buildId=" + tl.getVariable("Build.BuildId");
    }
    else {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_releaseProgress?releaseId=" + tl.getVariable("Release.ReleaseId");
    }

    return pipelineUrl;
}

function getServerUrl(clusterInfo: any): string {
    let serverUrl: string = "";
    let serverUrlMatch = clusterInfo.match(matchPatternForServerUrl);
    if (serverUrlMatch && serverUrlMatch.length >= 1) {
        serverUrl = serverUrlMatch[0];
    }

    return serverUrl;
}

export function extractManifestsFromHelmOutput(helmOutput: string): any {
    let manifestObjects = [];
    let manifestFiles = "";
    // The output stream contains the manifest file between the manifest and last deployed fields
    const manifestString = "manifest:";
    const lastDeployedString = "last deployed:";
    let indexOfManifests = helmOutput.toLowerCase().indexOf(manifestString);
    let indexOfLastDeployed = helmOutput.toLowerCase().indexOf(lastDeployedString);
    if (indexOfManifests >= 0 && indexOfLastDeployed >= 0) {
        manifestFiles = helmOutput.substring(indexOfManifests + manifestString.length, indexOfLastDeployed);
    }

    if (manifestFiles) {
        // Each of the source manifests is separated in output stream via string '---'
        const files = manifestFiles.split("---");
        files.forEach(file => {
            file = file.trim();
            if (file) {
                const parsedObject = yaml.safeLoad(file);
                manifestObjects.push(parsedObject);
            }
        });
    }

    return manifestObjects;
}

export function getManifestFileUrlsFromArgumentsInput(fileArgs: string): string[] {
    let manifestFileUrls: string[] = [];
    const filePathMatch: string[] = fileArgs.split(matchPatternForFileArgument);
    if (filePathMatch && filePathMatch.length > 0) {
        filePathMatch.forEach(manifestPath => {
            if (!!manifestPath) {
                if (manifestPath.startsWith("http") || manifestPath.startsWith("https:")) {
                    manifestFileUrls.push(manifestPath);
                }
                else {
                    manifestFileUrls.push(...getManifestUrls([manifestPath]));
                }
            }
        });
    }

    return manifestFileUrls;
}

export function getManifestFileUrlsFromHelmOutput(helmOutput: string): string[] {
    const chartType = tl.getInput("chartType", true);
    // Raw github links are supported only for chart names not chart paths
    if (chartType === "Name") {
        const chartName = tl.getInput("chartName", true);
        if (chartName.startsWith("http:") || chartName.startsWith("https:")) {
            return [chartName];
        }
    }

    let manifestFilePaths: string[] = [];
    // Extract the chart directory
    const directoryName = getChartDirectoryName(helmOutput);
    // Extract all source paths; source path example - # Source: MyChart/templates/pod.yaml
    const filePathMatches = helmOutput.match(matchPatternForSource);
    if (filePathMatches && filePathMatches.length >= 1) {
        filePathMatches.forEach(filePathMatch => {
            // Strip the Chart name from source path to get the template path
            let indexOfTemplate = filePathMatch.toLowerCase().indexOf("templates");
            const templatePath = indexOfTemplate >= 0 ? filePathMatch.substr(indexOfTemplate) : filePathMatch;
            manifestFilePaths.push(directoryName + "/" + templatePath.trim());
        });
    }

    return getManifestUrls(manifestFilePaths);
}

export function getChartDirectoryName(helmOutput: string): string {
    // The output contains chart path in the following format - CHART PATH: C:\agent\_work\2\s\helm-chart-directory
    let directoryName = "";
    const chartPathMatch = helmOutput.match(matchPatternForChartPath);
    if (chartPathMatch && chartPathMatch.length >= 1) {
        let fullPath = chartPathMatch[1];
        let indexOfLastSeparator = fullPath.lastIndexOf("\\");
        directoryName = indexOfLastSeparator >= 0 ? fullPath.substr(indexOfLastSeparator + 1) : fullPath;
    }

    return directoryName;
}

export function getManifestUrls(manifestFilePaths: string[]): string[] {
    let manifestUrls = [];
    const branchName = getBranchName(branch);
    for (const path of manifestFilePaths) {
        let manifestUrl = "";
        let normalisedPath = path.indexOf(workingDirectory) === 0 ? path.substr(workingDirectory.length) : path;
        normalisedPath = normalisedPath.replace(/\\/g, "/");

        if (repositoryProvider && (repositoryProvider.toLowerCase() === "githubenterprise" || repositoryProvider.toLowerCase() === "github")) {
            if (normalisedPath.indexOf("/") != 0) {
                // Prepend "/" if not present in path beginning as the path is appended as it is in manifest url to access github repo
                normalisedPath = "/" + normalisedPath;
            }

            manifestUrl = repositoryUrl + "/blob/" + branchName + normalisedPath;
        }
        else if (repositoryProvider && repositoryProvider.toLowerCase() === "tfsgit") {
            if (normalisedPath.indexOf("/") === 0) {
                // Remove "/" from path if present in the beginning as we need to append path as a query string in manifest url to access tfs repo
                normalisedPath = normalisedPath.substr(1);
            }

            manifestUrl = repositoryUrl + "?path=" + normalisedPath;
        }

        manifestUrls.push(manifestUrl);
    }

    return manifestUrls;
}

function getBranchName(ref: string): string {
    const gitRefsHeadsPrefix = "refs/heads/";
    if (ref && ref.indexOf(gitRefsHeadsPrefix) === 0) {
        return ref.substr(gitRefsHeadsPrefix.length);
    }

    return ref;
}

function getPlatform(): string {
    let platform: string = "Custom";
    const connectionType = tl.getInput("connectionType");
    if (connectionType === "Azure Resource Manager") {
        platform = "AKS";
    }

    return platform;
}

export function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export function getPublishDeploymentRequestUrl(): string {
    return orgUrl + tl.getVariable("System.TeamProject") + "/_apis/deployment/deploymentdetails?api-version=5.2-preview.1";
}

export function isDeploymentEntity(kind: string): boolean {
    return deploymentTypes.some((type: string) => {
        return kind.toLowerCase() === type;
    });
}

export function isPodEntity(kind: string): boolean {
    if (!kind) {
        tl.warning("ResourceKindNotDefined");
        return false;
    }

    return kind.toLowerCase() === "pod";
}
