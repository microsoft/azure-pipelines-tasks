import tl = require('azure-pipelines-task-lib');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    command: "__command__",
    containerType: "__container_type__",
    qualifyImageName: "__qualifyImageName__",
    includeLatestTag: "__includeLatestTag__",
    imageName: "__imageName__",
    enforceDockerNamingConvention: "__enforceDockerNamingConvention__",
    memoryLimit: "__memoryLimit__",
    pushMultipleImages: "__pushMultipleImages__",
    tagMultipleImages: "__tagMultipleImages__",
    arguments: "__arguments__",
    qualifySourceImageName: "__qualifySourceImageName__",
    addBaseImageData: "addBaseImageData"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export let CommandTypes = {
    buildImage: "Build an image",
    tagImages: "Tag image",
    pushImage: "Push an image",
    runImage: "Run an image"
};

export let ContainerTypes = {
    AzureContainerRegistry: "Azure Container Registry",
    ContainerRegistry: "Container Registry"
}

export let ImageNamesFileImageName = "test_image";

export let BaseImageName = "ubuntu";
export let BaseImageLabels = {
    name:"image.base.ref.name=ubuntu",
    digest:"image.base.digest=sha256:826f70e0ac33e99a72cf20fb0571245a8fee52d68cb26d8bc58e53bfa65dcdfa"
};
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