import tl = require('azure-pipelines-task-lib');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    containerType: "__container_type__",
    command: "__command__",
    useConfigurationFile: "__useConfigurationFile__",
    configuration: "__configuration__",
    arguments: "__arguments__",
    namespace: "__namespace__",
    secretType: "__secretType__",
    secretArguments: "__secretArguments__",
    secretName: "__secretName__",
    forceUpdate: "__forceUpdate__",
    configMapName: "__configMapName__",
    forceUpdateConfigMap: "__forceUpdateConfigMap__",
    useConfigMapFile: "__useConfigMapFile__",
    configMapFile: "__configMapFile__",
    configMapArguments: "__configMapArguments__",
    versionOrLocation: "__versionOrLocation__",
    versionSpec: "__versionspec__",
    checkLatest: "__checkLatest__",
    specifyLocation: "__specifyLocation__",
    outputFormat: "__outputFormat__",
    kubectlOutput: "__kubectlOutput__"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export let Commands = {
    apply: "apply",
    create: "create",
    delete: "delete",
    exec: "exec",
    expose: "expose",
    get: "get",
    logs: "logs",
    run: "run",
    set: "set",
    top: "top"
};

export let isKubectlPresentOnMachine = "true"; 
export let endpointAuthorizationType = "Kubeconfig";

export let ContainerTypes = {
    AzureContainerRegistry: "Azure Container Registry",
    ContainerRegistry: "Container Registry"
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