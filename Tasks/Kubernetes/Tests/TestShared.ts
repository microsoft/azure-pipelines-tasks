import tl = require('vsts-task-lib');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    command: "__command__",
    containerType: "__container_type__",
    useConfigurationFile: "__useConfigurationFile__",
    configuration: "__configuration__",
    namespace: "__namespace__",
    secretName: "__secretName__",
    arguments: "__arguments__",
    forceUpdate: "__forceUpdate__",
    versionOrLocation: "__versionOrLocation__",
    versionSpec: "__versionSpec__",
    checkLatest: "__checkLatest__",
    specifyLocation: "__specifyLocation__",
    kubectlOutput: "__kubectlOutput__",
    outputFormat: "__outputFormat__"
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
export let ConfigurationFile = "deployment.yaml";

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