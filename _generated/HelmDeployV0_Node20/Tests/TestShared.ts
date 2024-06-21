import path = require('path');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    connectionType: "__connectionType__",
    azureSubscriptionEndpoint: "__azureSubscriptionEndpoint__",
    azureResourceGroup: "__azureResourceGroup__",
    kubernetesCluster: "__kubernetesCluster__",
    useClusterAdmin: "__useClusterAdmin__",
    kubernetesServiceEndpoint: "__kubernetesServiceEndpoint__",
    namespace: "__namespace__",
    azureSubscriptionEndpointForACR: "__azureSubscriptionEndpointForACR__",
    azureResourceGroupForACR: "__azureResourceGroupForACR",
    azureContainerRegistry: "__azureContainerRegistry__",
    command: "__command__",
    chartType: "__chartType__",
    chartName: "__chartName__",
    chartPath: "__chartPath__",
    version: "__version__",
    releaseName: "__releaseName__",
    overrideValues: "__overrideValues__",
    valueFile: "__valueFile__",
    destination: "__destination__",
    canaryimage: "__canaryimage__",
    upgradetiller: "__upgradetiller__",
    updatedependency: "__updatedependency__",
    save: "__save__",
    install: "__install__",
    recreate: "__recreate__",
    resetValues: "__resetValues__",
    force: "__force__",
    waitForExecution: "__waitForExecution__",
    arguments: "__arguments__",
    failOnStderr: "__failOnStderr__",
    publishPipelineMetadata: "__publishPipelineMetadata__",
    chartNameForACR: "__chartNameForACR__",
    chartPathForACR: "__chartPathForACR__"
};

export let Commands = {
    install: "install",
    upgrade: "upgrade",
    package: "package",
    save: "save",
    init: "init"
};

export let ChartTypes = {
    Name: "Name",
    FilePath: "FilePath"
};

export let ConnectionTypes = {
    KubernetesServiceConnection: "Kubernetes Service Connection",
    AzureResourceManager: "Azure Resource Manager",
    None: "None"
}

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export const testChartName = "testChartName";
export const testChartPath = "test/testChartPath";
export const testChartVersion = "1.1.1";
export const testReleaseName = "testReleaseName";
export const isHelmV3 = "__isHelmV3__";
export const testNamespace = "testNamespace";
export const testDestinationPath = "testDestinationPath";
export const testChartNameForACR = "testChartNameForACR";
export const testChartPathForACR = "test/testChartPathForACR";
export const testAzureResourceGroupForACR = "test-rg";
export const testAzureSubscriptionEndpointForACR = "RMTest";
export const testAzureContainerRegistry = "sonayak.azurecr.io";

/**
 * Formats the given path to be appropriate for the operating system.
 * @param canonicalPath A non-rooted path using a forward slash (/) as a directory separator.
 */
export function formatPath(canonicalPath: string) {
    if (process.env[TestEnvVars.operatingSystem] === OperatingSystems.Windows) {
        return "F:\\" + canonicalPath.replace("/", "\\");
    } else {
        return "/" + canonicalPath;
    }
};

/**
 * Returns '--debug' flag if the pipeline is in debug mode otherwise empty string is returned.
 */
export function formatDebugFlag(): string {
    return process.env.SYSTEM_DEBUG === 'true' ? ' --debug' : '';
}
