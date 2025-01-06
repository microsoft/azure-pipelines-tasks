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
    memory: "__memory__",
    addBaseImageData: "__addBaseImageData__"
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
export let BaseImageLabels = {
    name:"image.base.ref.name=ubuntu",
    digest:"image.base.digest=sha256:826f70e0ac33e99a72cf20fb0571245a8fee52d68cb26d8bc58e53bfa65dcdfa"
};

export let teamFoundationCollectionURI = "https://abc.visualstudio.com/";

export let DockerCommandArgs = {
    BuildLabels: `--label com.visualstudio.abc.image.system.teamfoundationcollectionuri=${teamFoundationCollectionURI}`,
}
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