import path = require('path');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    connectionType: "__connectionType__",
    kubernetesServiceEndpoint: "__kubernetesServiceEndpoint__",
    namespace: "__namespace__",
    action: "__action__",
    strategy: "__strategy__",
    percentage: "__percentage__",
    configuration: "__configuration__",
    manifests: "__manifests__",
    containers: "__containers__",
    imagePullSecrets: "__imagePullSecrets__",
    dockerComposeFile: "__dockerComposeFile__",
    kustomizationPath: "__kustomizationPath__",
    renderType: "__renderType__",
    releaseName: "__releaseName__",
    helmChart: "__helmChart__",
    helmVersion: "__helmVersion__",
    secretName: "__secretName__",
    secretType: "__secretType__",
    overrideFiles: "__overrideFiles__",
    overrides: "__overrides__",
    resourceToPatch: "__resourceToPatch__",
    resourceFileToPatch: "__resourceFileToPatch__",
    kind: "__kind__",
    name: "__name__",
    replicas: "__replicas__",
    mergeStrategy: "__mergeStrategy__",
    arguments: "__arguments__",
    patch: "__patch__",
    resourceName: "__resourceName__",
    isKubectlPresentOnMachine: "__isKubectlPresentOnMachine__",
    endpointAuthorizationType: "__endpointAuthorizationType__",
    isStableDeploymentPresent: "__isStableDeploymentPresent__",
    isCanaryDeploymentPresent: "__isCanaryDeploymentPresent__",
    isBaselineDeploymentPresent: "__isBaselineDeploymentPresent__",
    baselineAndCanaryReplicas: "__baselineAndCanaryReplicas__",
    trafficSplitMethod: "__trafficSplitMethod__"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export let AuthorizationType = {
    Kubeconfig : "Kubeconfig",
    ServiceAccount : "ServiceAccount",
    AzureSubscription : "AzureSubscription"
};

export let Actions = {
    bake: "bake",
    createSecret: "createSecret",
    deploy: "deploy",
    patch: "patch",
    scale: "scale",
    delete: "delete",
    reject: "reject",
    promote: "promote"
};

export let Strategy = {
    canary: "canary",
    none: "none"
};

export let TrafficSplitMethod = {
    pod: "pod",
    smi: "smi"
};

export const ManifestFilesPath = path.join(__dirname, 'manifests', 'deployment.yaml');
export const CanaryManifestFilesPath = path.join(__dirname, 'manifests', 'deployment-canary.yaml');
export const BaselineManifestFilesPath = path.join(__dirname, 'manifests', 'deployment-baseline.yaml');
export const DeleteCmdArguments  = "deployment nginx-deployment";

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