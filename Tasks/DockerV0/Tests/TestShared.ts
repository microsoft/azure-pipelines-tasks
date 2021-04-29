import tl = require('azure-pipelines-task-lib');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    action: "__command__",
    containerType: "__container_type__",
    qualifyImageName: "__qualifyImageName__",
    includeLatestTag: "__includeLatestTag__",
    imageName: "__imageName__",
    additionalImageTags: "__additionalImageTags__",
    enforceDockerNamingConvention: "__enforceDockerNamingConvention__",
    memory: "__memory__"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export let ActionTypes = {
    buildImage: "Build an image",
    tagImages: "Tag images",
    pushImage: "Push an image",
    pushImages: "Push images",
    runImage: "Run an image",
    dockerCommand: "Run a Docker command"
};

export let ContainerTypes = {
    AzureContainerRegistry: "Azure Container Registry",
    ContainerRegistry: "Container Registry"
}

export let ImageNamesFileImageName = "test_image";
export let BaseImageName = "ubuntu";

/**
 * Formats the given path to be appropriate for the operating system.
 * @param canonicalPath A non-rooted path using a forward slash (/) as a directory separator.
 */
export function formatPath(canonicalPath: string) {
    if (process.env[TestEnvVars.operatingSystem] === OperatingSystems.Windows) {
        return "F:\\" + canonicalPath.replace('/', '\\');
    } else {
        return "/" + canonicalPath;
    }
};