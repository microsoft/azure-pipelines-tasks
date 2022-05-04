import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import * as semver from 'semver';

import * as shared from './TestShared';
import { formatDebugFlag } from './TestShared';

const buildNumber = "123";
const buildId = "1";
const buildReason = "schedule";
const teamProject = "project1";
const collectionId = "collection1";
const definitionName = "test";
const definitionId = "123";
const teamFoundationCollectionUri = "https://abc.visualstudio.com/";
const jobName = "jobName";
const accessToken = "testAccessToken";

const testnamespaceWorkingDirectory: string = shared.formatPath("a/w");
const kubectlPath = shared.formatPath("newUserDir/kubectl.exe");
const helmPath = shared.formatPath("newUserDir/helm.exe");

const taskPath = path.join(__dirname, "../src", "helm.js");
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("kubernetesServiceEndpoint", "kubernetesConnection");
tr.setInput("connectionType", process.env[shared.TestEnvVars.connectionType] || "");
tr.setInput("azureSubscriptionEndpoint", process.env[shared.TestEnvVars.azureSubscriptionEndpoint] || "");
tr.setInput("azureResourceGroup", process.env[shared.TestEnvVars.azureResourceGroup] || "");
tr.setInput("kubernetesCluster", process.env[shared.TestEnvVars.kubernetesCluster] || "");
tr.setInput("useClusterAdmin", process.env[shared.TestEnvVars.useClusterAdmin] || "");
tr.setInput("namespace", process.env[shared.TestEnvVars.namespace] || "");
tr.setInput("azureSubscriptionEndpointForACR", process.env[shared.TestEnvVars.azureSubscriptionEndpointForACR] || "");
tr.setInput("azureResourceGroupForACR", process.env[shared.TestEnvVars.azureResourceGroupForACR] || "");
tr.setInput("azureContainerRegistry", process.env[shared.TestEnvVars.azureContainerRegistry] || "");
tr.setInput("command", process.env[shared.TestEnvVars.command] || "");
tr.setInput("chartType", process.env[shared.TestEnvVars.chartType] || "");
tr.setInput("chartName", process.env[shared.TestEnvVars.chartName] || "");
tr.setInput("chartPath", process.env[shared.TestEnvVars.chartPath] || "");
tr.setInput("version", process.env[shared.TestEnvVars.version] || "");
tr.setInput("releaseName", process.env[shared.TestEnvVars.releaseName] || "");
tr.setInput("overrideValues", process.env[shared.TestEnvVars.overrideValues] || "");
tr.setInput("valueFile", process.env[shared.TestEnvVars.valueFile] || "");
tr.setInput("destination", process.env[shared.TestEnvVars.destination] || "");
tr.setInput("canaryimage", process.env[shared.TestEnvVars.canaryimage] || "");
tr.setInput("upgradetiller", process.env[shared.TestEnvVars.upgradetiller] || "");
tr.setInput("updatedependency", process.env[shared.TestEnvVars.updatedependency] || "");
tr.setInput("save", process.env[shared.TestEnvVars.save] || "");
tr.setInput("install", process.env[shared.TestEnvVars.install] || "");
tr.setInput("recreate", process.env[shared.TestEnvVars.recreate] || "");
tr.setInput("resetValues", process.env[shared.TestEnvVars.resetValues] || "");
tr.setInput("force", process.env[shared.TestEnvVars.force] || "");
tr.setInput("waitForExecution", process.env[shared.TestEnvVars.waitForExecution] || "");
tr.setInput("arguments", process.env[shared.TestEnvVars.arguments] || "");
tr.setInput("failOnStderr", process.env[shared.TestEnvVars.failOnStderr] || "true");
tr.setInput("publishPipelineMetadata", process.env[shared.TestEnvVars.publishPipelineMetadata] || "true");
tr.setInput("chartNameForACR", process.env[shared.TestEnvVars.chartNameForACR] || "");
tr.setInput("chartPathForACR", process.env[shared.TestEnvVars.chartPathForACR] || "");

process.env.SYSTEM_DEFAULTWORKINGDIRECTORY = testnamespaceWorkingDirectory;
process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = teamFoundationCollectionUri;
process.env.SYSTEM_TEAMPROJECT = teamProject;
process.env.SYSTEM_COLLECTIONID = collectionId;
process.env.SYSTEM_DEFINITIONID = definitionId;
process.env.ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN = accessToken;

process.env.BUILD_BUILDID = buildId;
process.env.BUILD_BUILDNUMBER = buildNumber;
process.env.BUILD_DEFINITIONNAME = definitionName;
process.env.BUILD_REASON = buildReason;

process.env.AGENT_JOBNAME = jobName;
process.env.SYSTEM_HOSTTYPE = "build";

process.env.ENDPOINT_DATA_kubernetesConnection_AUTHORIZATIONTYPE = "Kubeconfig";
process.env.ENDPOINT_AUTH_PARAMETER_kubernetesConnection_KUBECONFIG = `{"apiVersion":"v1", "clusters": [{"cluster": {"insecure-skip-tls-verify":"true", "server":"https://5.6.7.8", "name" : "scratch"}}], "contexts": [{"context" : {"cluster": "scratch", "namespace" : "default", "user": "experimenter", "name" : "exp-scratch"}], "current-context" : "exp-scratch", "kind": "Config", "users" : [{"user": {"password": "regpassword", "username" : "test"}]}`;
process.env.ENDPOINT_DATA_kubernetesConnection_NAMESPACE = "testnamespace";

if (process.env.RemoveNamespaceFromEndpoint) {
    process.env.ENDPOINT_DATA_kubernetesConnection_NAMESPACE = "";
}

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath": {
        "helm": true,
        "kubectl": true
    },
    "exec": {
    },
    "findMatch": {},
    "which": {
        "helm": "helm",
        "kubectl": "kubectl"
    }
};

if (process.env[shared.TestEnvVars.command] === shared.Commands.install) {
    let helmInstallCommand = `helm install${formatDebugFlag()}`;

    if (process.env[shared.TestEnvVars.namespace])
        helmInstallCommand = helmInstallCommand.concat(` --namespace ${process.env[shared.TestEnvVars.namespace]}`);

    if (process.env[shared.TestEnvVars.valueFile]) 
        helmInstallCommand = helmInstallCommand.concat(` --values ${process.env[shared.TestEnvVars.valueFile]}`);

    if (process.env[shared.TestEnvVars.overrideValues])
        helmInstallCommand = helmInstallCommand.concat(` --set ${process.env[shared.TestEnvVars.overrideValues]}`);

    if (process.env[shared.isHelmV3] === "true") {
        if (process.env[shared.TestEnvVars.releaseName])
            helmInstallCommand = helmInstallCommand.concat(` ${process.env[shared.TestEnvVars.releaseName]}`);
        else
            helmInstallCommand = helmInstallCommand.concat(" --generate-name");
    }
    else if (process.env[shared.TestEnvVars.releaseName])
        helmInstallCommand = helmInstallCommand.concat(` --name ${process.env[shared.TestEnvVars.releaseName]}`);

    if (process.env[shared.TestEnvVars.waitForExecution])
        helmInstallCommand = helmInstallCommand.concat(" --wait");

    if (process.env[shared.TestEnvVars.updatedependency])
        if (process.env[shared.isHelmV3] === "true") {
            helmInstallCommand = helmInstallCommand.concat(" --dependency-update");
        } else {
            helmInstallCommand = helmInstallCommand.concat(" --dep-up");
        }

    if (process.env[shared.TestEnvVars.arguments])
        helmInstallCommand = helmInstallCommand.concat(` ${process.env[shared.TestEnvVars.arguments]}`);

    if (process.env[shared.TestEnvVars.chartName])
        helmInstallCommand = helmInstallCommand.concat(` ${process.env[shared.TestEnvVars.chartName]}`);
    else if (process.env[shared.TestEnvVars.chartPath])
        helmInstallCommand = helmInstallCommand.concat(` ${process.env[shared.TestEnvVars.chartPath]}`);

    if (process.env[shared.TestEnvVars.version] && semver.valid(process.env[shared.TestEnvVars.version]))
        helmInstallCommand = helmInstallCommand.concat(` --version ${process.env[shared.TestEnvVars.version]}`);

    a.exec[helmInstallCommand] = {
        "code": 0,
        "stdout": `NAME: ${shared.testReleaseName} \nLAST DEPLOYED: Mon Jun  8 10:30:31 2020 \nNAMESPACE: ${process.env[shared.TestEnvVars.namespace]} \nSTATUS: deployed \nREVISION: 1 \nNOTES: \n1. Get the application URL by running these commands: \n  export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=demo-chart,app.kubernetes.io/ \n  instance=mytestv2" -o jsonpath="{.items[0].metadata.name}") \n  echo "Visit http://127.0.0.1:8080 to use your application" \n  kubectl --namespace default port-forward $POD_NAME 8080:80`
    };
}

if (process.env[shared.TestEnvVars.command] === shared.Commands.upgrade) {
    let helmUpgradeCommand = `helm upgrade${formatDebugFlag()}`;

    if (process.env[shared.TestEnvVars.namespace])
        helmUpgradeCommand = helmUpgradeCommand.concat(` --namespace ${process.env[shared.TestEnvVars.namespace]}`);

    if (process.env[shared.TestEnvVars.install])
        helmUpgradeCommand = helmUpgradeCommand.concat(" --install");

    if (process.env[shared.TestEnvVars.recreate])
        helmUpgradeCommand = helmUpgradeCommand.concat(" --recreate-pods");

    if (process.env[shared.TestEnvVars.resetValues])
        helmUpgradeCommand = helmUpgradeCommand.concat(" --reset-values");

    if (process.env[shared.TestEnvVars.force])
        helmUpgradeCommand = helmUpgradeCommand.concat(" --force");

    if (process.env[shared.TestEnvVars.valueFile]) 
        helmUpgradeCommand = helmUpgradeCommand.concat(` --values ${process.env[shared.TestEnvVars.valueFile]}`);

    if (process.env[shared.TestEnvVars.overrideValues])
        helmUpgradeCommand = helmUpgradeCommand.concat(` --set ${process.env[shared.TestEnvVars.overrideValues]}`);

    if (process.env[shared.TestEnvVars.waitForExecution])
        helmUpgradeCommand = helmUpgradeCommand.concat(" --wait");

    if (process.env[shared.TestEnvVars.arguments])
        helmUpgradeCommand = helmUpgradeCommand.concat(` ${process.env[shared.TestEnvVars.arguments]}`);

    if (process.env[shared.TestEnvVars.releaseName])
        helmUpgradeCommand = helmUpgradeCommand.concat(` ${process.env[shared.TestEnvVars.releaseName]}`);
    else
        helmUpgradeCommand = helmUpgradeCommand.concat(` ${process.env.BUILD_BUILDNUMBER}`);

    if (process.env[shared.TestEnvVars.chartName])
        helmUpgradeCommand = helmUpgradeCommand.concat(` ${process.env[shared.TestEnvVars.chartName]}`);
    else if (process.env[shared.TestEnvVars.chartPath])
        helmUpgradeCommand = helmUpgradeCommand.concat(` ${process.env[shared.TestEnvVars.chartPath]}`);

    if (process.env[shared.TestEnvVars.version] && semver.valid(process.env[shared.TestEnvVars.version]))
        helmUpgradeCommand = helmUpgradeCommand.concat(` --version ${process.env[shared.TestEnvVars.version]}`);

    a.exec[helmUpgradeCommand] = {
        "code": 0,
        "stdout": `Release "${shared.testReleaseName}" has been upgraded. Happy Helming!\nNAME: ${shared.testReleaseName} \nLAST DEPLOYED: Mon Jun  8 10:30:31 2020 \nNAMESPACE: ${process.env[shared.TestEnvVars.namespace]} \nSTATUS: deployed \nREVISION: 1 \nNOTES: \n1. Get the application URL by running these commands: \n  export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=demo-chart,app.kubernetes.io/ \n  instance=mytestv2" -o jsonpath="{.items[0].metadata.name}") \n  echo "Visit http://127.0.0.1:8080 to use your application" \n  kubectl --namespace default port-forward $POD_NAME 8080:80`
    };
}

if (process.env[shared.TestEnvVars.command] === shared.Commands.init) {
    let helmInitCommand = `helm init${formatDebugFlag()}`;

    if (process.env[shared.TestEnvVars.canaryimage])
        helmInitCommand = helmInitCommand.concat(" --canary-image");

    if (process.env[shared.TestEnvVars.upgradetiller])
        helmInitCommand = helmInitCommand.concat(" --upgrade");

    if (process.env[shared.TestEnvVars.waitForExecution])
        helmInitCommand = helmInitCommand.concat(" --wait");

    if (process.env[shared.TestEnvVars.arguments])
        helmInitCommand = helmInitCommand.concat(` ${process.env[shared.TestEnvVars.arguments]}`);

    if (process.env[shared.isHelmV3] === "true") {
        a.exec[helmInitCommand] = {
            "code": 1,
            "stdout": "The Kubernetes package manager\n\nCommon actions for Helm:\n\n- helm search:    search for charts\n- helm pull:      download a chart to your local directory to view\n- helm install:   upload the chart to Kubernetes\n- helm list:      list releases of charts\n"
        };
    } else {
        a.exec[helmInitCommand] = {
            "code": 0,
            "stdout": `$HELM_HOME has been configured at testPath\\.helm.`
        };
    }
}

if (process.env[shared.TestEnvVars.command] === shared.Commands.package) {
    let helmPackageCommand = `helm package${formatDebugFlag()}`;

    if (process.env[shared.TestEnvVars.save]) {
        if (process.env[shared.isHelmV3])
            helmPackageCommand = helmPackageCommand.concat(" --save");
    }

    if (process.env[shared.TestEnvVars.updatedependency])
        if (process.env[shared.isHelmV3] === "true") {
            helmPackageCommand = helmPackageCommand.concat(" --dependency-update");
        } else {
            helmPackageCommand = helmPackageCommand.concat(" --dep-up");
        }

    if (process.env[shared.TestEnvVars.version])
        helmPackageCommand = helmPackageCommand.concat(` --version ${process.env[shared.TestEnvVars.version]}`);

    if (process.env[shared.TestEnvVars.destination])
        helmPackageCommand = helmPackageCommand.concat(` --destination ${process.env[shared.TestEnvVars.destination]}`);

    if (process.env[shared.TestEnvVars.arguments])
        helmPackageCommand = helmPackageCommand.concat(` ${process.env[shared.TestEnvVars.arguments]}`);

    if (process.env[shared.TestEnvVars.chartPath])
        helmPackageCommand = helmPackageCommand.concat(` ${process.env[shared.TestEnvVars.chartPath]}`);
    a.exec[helmPackageCommand] = {
        "code": 0,
        "stdout": "Successfully packaged chart and saved it to: testDestinationPath/testChartName.tgz"
    }
}

const helmVersionCommand = "helm version --client --short";
if (process.env[shared.isHelmV3]) {
    a.exec[helmVersionCommand] = {
        "code": 0,
        "stdout": "v3.2.1+ge29ce2a"
    };
}
else {
    a.exec[helmVersionCommand] = {
        "code": 0,
        "stdout": "Client: v2.16.7+g5f2584f"
    };
}

if (process.env[shared.TestEnvVars.namespace]) {
    const helmGetManifestCommand = `helm get manifest ${shared.testReleaseName} --namespace ${process.env[shared.TestEnvVars.namespace]}`;
    a.exec[helmGetManifestCommand] = {
        "code": 0,
        "stdout": `---\n# Source: testChartName/templates/serviceaccount.yaml\n{apiVersion: v1, kind: ServiceAccount, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}}\n---\n# Source: testChartName/templates/service.yaml\n{apiVersion: v1, kind: Service, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}, spec: {type: ClusterIP, ports: [{port: 80, targetPort: http, protocol: TCP, name: http}], selector: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}}\n---\n# Source: demo-chart/templates/deployment.yaml\n{apiVersion: apps/v1, kind: Deployment, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}, spec: {replicas: 1, selector: {matchLabels: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}, template: {metadata: {labels: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}, spec: {serviceAccountName: testReleaseName-testChartName, securityContext: {}, containers: [{name: testChartName, securityContext: {}, image: "testImage:1.17.0", imagePullPolicy: Always, ports: [{name: http, containerPort: 80, protocol: TCP}], livenessProbe: {httpGet: {path: /, port: http}}, readinessProbe: {httpGet: {path: /, port: http}}, resources: {}}]}}}}\n`
    }

    const kubectlGetPods = `kubectl get pods -o json --namespace ${process.env[shared.TestEnvVars.namespace]}`;
    a.exec[kubectlGetPods] = {
        "code": 0,
        "stdout": `{"apiVersion":"v1","items":[{"apiVersion":"v1","kind":"Pod","metadata":{"creationTimestamp":"2020-06-10T18:20:57Z","generateName":"testReleaseName-testChartName-7966fd9bdb-","labels":{"app":"demo","pod-template-hash":"7966fd9bdb"},"name":"testReleaseName-testChartName-7966fd9bdb-wvz9w","namespace":"default","ownerReferences":[{"apiVersion":"apps/v1","blockOwnerDeletion":true,"controller":true,"kind":"ReplicaSet","name":"testReleaseName-testChartName-7966fd9bdb","uid":"ceb16411-6edc-4598-827e-027e8c68304e"}],"resourceVersion":"987","selfLink":"/api/v1/namespaces/default/pods/testReleaseName-testChartName-7966fd9bdb-wvz9w","uid":"ac838bab-a280-4189-b3e9-45bf9d8df920"},"spec":{"containers":[{"image":"nginx:latest","imagePullPolicy":"Always","name":"demo-cont","ports":[{"containerPort":80,"protocol":"TCP"}],"resources":{},"terminationMessagePath":"/dev/termination-log","terminationMessagePolicy":"File","volumeMounts":[{"mountPath":"/var/run/secrets/kubernetes.io/serviceaccount","name":"default-token-xp8jh","readOnly":true}]}],"dnsPolicy":"ClusterFirst","enableServiceLinks":true,"nodeName":"minikube","priority":0,"restartPolicy":"Always","schedulerName":"default-scheduler","securityContext":{},"serviceAccount":"default","serviceAccountName":"default","terminationGracePeriodSeconds":30,"tolerations":[{"effect":"NoExecute","key":"node.kubernetes.io/not-ready","operator":"Exists","tolerationSeconds":300},{"effect":"NoExecute","key":"node.kubernetes.io/unreachable","operator":"Exists","tolerationSeconds":300}],"volumes":[{"name":"default-token-xp8jh","secret":{"defaultMode":420,"secretName":"default-token-xp8jh"}}]},"status":{"conditions":[{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:20:57Z","status":"True","type":"Initialized"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:21:21Z","status":"True","type":"Ready"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:21:21Z","status":"True","type":"ContainersReady"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:20:57Z","status":"True","type":"PodScheduled"}],"containerStatuses":[{"containerID":"docker://9be62c1a895983aefde3b62c33f12a692ab3749fd841a1f9b7c813b4246d1ac7","image":"nginx:latest","imageID":"docker-pullable://nginx@sha256:21f32f6c08406306d822a0e6e8b7dc81f53f336570e852e25fbe1e3e3d0d0133","lastState":{},"name":"demo-cont","ready":true,"restartCount":0,"started":true,"state":{"running":{"startedAt":"2020-06-10T18:21:20Z"}}}],"hostIP":"192.168.105.196","phase":"Running","podIP":"172.17.0.6","podIPs":[{"ip":"172.17.0.6"}],"qosClass":"BestEffort","startTime":"2020-06-10T18:20:57Z"}}],"kind":"List","metadata":{"resourceVersion":"","selfLink":""}}\n`
    }
}
else {
    const helmGetManifestCommand = `helm get manifest ${shared.testReleaseName}`;
    a.exec[helmGetManifestCommand] = {
        "code": 0,
        "stdout": `---\n# Source: testChartName/templates/serviceaccount.yaml\n{apiVersion: v1, kind: ServiceAccount, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}}\n---\n# Source: testChartName/templates/service.yaml\n{apiVersion: v1, kind: Service, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}, spec: {type: ClusterIP, ports: [{port: 80, targetPort: http, protocol: TCP, name: http}], selector: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}}\n---\n# Source: demo-chart/templates/deployment.yaml\n{apiVersion: apps/v1, kind: Deployment, metadata: {name: testReleaseName-testChartName, labels: {helm.sh/chart: testChartName-0.1.0, app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName, app.kubernetes.io/version: 1.17.0, app.kubernetes.io/managed-by: Helm}}, spec: {replicas: 1, selector: {matchLabels: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}, template: {metadata: {labels: {app.kubernetes.io/name: testChartName, app.kubernetes.io/instance: testReleaseName}}, spec: {serviceAccountName: testReleaseName-testChartName, securityContext: {}, containers: [{name: testChartName, securityContext: {}, image: "testImage:1.17.0", imagePullPolicy: Always, ports: [{name: http, containerPort: 80, protocol: TCP}], livenessProbe: {httpGet: {path: /, port: http}}, readinessProbe: {httpGet: {path: /, port: http}}, resources: {}}]}}}}\n`
    }
    
    const kubectlGetPods = "kubectl get pods -o json";
    a.exec[kubectlGetPods] = {
        "code": 0,
        "stdout": `{"apiVersion":"v1","items":[{"apiVersion":"v1","kind":"Pod","metadata":{"creationTimestamp":"2020-06-10T18:20:57Z","generateName":"testReleaseName-testChartName-7966fd9bdb-","labels":{"app":"demo","pod-template-hash":"7966fd9bdb"},"name":"testReleaseName-testChartName-7966fd9bdb-wvz9w","namespace":"default","ownerReferences":[{"apiVersion":"apps/v1","blockOwnerDeletion":true,"controller":true,"kind":"ReplicaSet","name":"testReleaseName-testChartName-7966fd9bdb","uid":"ceb16411-6edc-4598-827e-027e8c68304e"}],"resourceVersion":"987","selfLink":"/api/v1/namespaces/default/pods/testReleaseName-testChartName-7966fd9bdb-wvz9w","uid":"ac838bab-a280-4189-b3e9-45bf9d8df920"},"spec":{"containers":[{"image":"nginx:latest","imagePullPolicy":"Always","name":"demo-cont","ports":[{"containerPort":80,"protocol":"TCP"}],"resources":{},"terminationMessagePath":"/dev/termination-log","terminationMessagePolicy":"File","volumeMounts":[{"mountPath":"/var/run/secrets/kubernetes.io/serviceaccount","name":"default-token-xp8jh","readOnly":true}]}],"dnsPolicy":"ClusterFirst","enableServiceLinks":true,"nodeName":"minikube","priority":0,"restartPolicy":"Always","schedulerName":"default-scheduler","securityContext":{},"serviceAccount":"default","serviceAccountName":"default","terminationGracePeriodSeconds":30,"tolerations":[{"effect":"NoExecute","key":"node.kubernetes.io/not-ready","operator":"Exists","tolerationSeconds":300},{"effect":"NoExecute","key":"node.kubernetes.io/unreachable","operator":"Exists","tolerationSeconds":300}],"volumes":[{"name":"default-token-xp8jh","secret":{"defaultMode":420,"secretName":"default-token-xp8jh"}}]},"status":{"conditions":[{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:20:57Z","status":"True","type":"Initialized"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:21:21Z","status":"True","type":"Ready"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:21:21Z","status":"True","type":"ContainersReady"},{"lastProbeTime":null,"lastTransitionTime":"2020-06-10T18:20:57Z","status":"True","type":"PodScheduled"}],"containerStatuses":[{"containerID":"docker://9be62c1a895983aefde3b62c33f12a692ab3749fd841a1f9b7c813b4246d1ac7","image":"nginx:latest","imageID":"docker-pullable://nginx@sha256:21f32f6c08406306d822a0e6e8b7dc81f53f336570e852e25fbe1e3e3d0d0133","lastState":{},"name":"demo-cont","ready":true,"restartCount":0,"started":true,"state":{"running":{"startedAt":"2020-06-10T18:21:20Z"}}}],"hostIP":"192.168.105.196","phase":"Running","podIP":"172.17.0.6","podIPs":[{"ip":"172.17.0.6"}],"qosClass":"BestEffort","startTime":"2020-06-10T18:20:57Z"}}],"kind":"List","metadata":{"resourceVersion":"","selfLink":""}}\n`
    }
}



const kubectlClusterInfo = "kubectl cluster-info";
a.exec[kubectlClusterInfo] = {
    "code": 0,
    "stdout": `Kubernetes master is running at https://shigupt-cluster-dns-7489360e.hcp.southindia.azmk8s.io:443 \nhealthmodel-replicaset-service is running at https://shigupt-cluster-dns-7489360e.hcp.southindia.azmk8s.io:443/api/v1/namespaces/kube-system/services/healthmodel-replicaset-service/proxy \nCoreDNS is running at https://shigupt-cluster-dns-7489360e.hcp.southindia.azmk8s.io:443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy \nkubernetes-dashboard is running at https://shigupt-cluster-dns-7489360e.hcp.southindia.azmk8s.io:443/api/v1/namespaces/kube-system/services/kubernetes-dashboard/proxy \nMetrics-server is running at https://shigupt-cluster-dns-7489360e.hcp.southindia.azmk8s.io:443/api/v1/namespaces/kube-system/services/https:metrics-server:/proxy\n\nTo further debug and diagnose cluster problems, use "kubectl cluster-info dump".\n`
}

const helmSaveCommand = `helm chart${formatDebugFlag()} save ${process.env[shared.TestEnvVars.chartPathForACR]} ${process.env[shared.TestEnvVars.azureContainerRegistry]}/helm/${process.env[shared.TestEnvVars.chartNameForACR]}`;
a.exec[helmSaveCommand] = {
    "code": 0,
    "stdout": `ref:    ${process.env[shared.TestEnvVars.azureContainerRegistry]}/helm/${process.env[shared.TestEnvVars.chartNameForACR]}:0.1.0 \n Successfully saved the helm chart to local registry cache.`
}

const helmRegistryLoginCommand = `helm registry${formatDebugFlag()} login ${process.env[shared.TestEnvVars.azureContainerRegistry]} --username --password`;
a.exec[helmRegistryLoginCommand] = {
    "code": 0,
    "stdout": `Successfully logged in to  ${process.env[shared.TestEnvVars.azureContainerRegistry]}.`
};

const helmChartPushCommand = `helm chart${formatDebugFlag()} push ${process.env[shared.TestEnvVars.azureContainerRegistry]}/helm/${process.env[shared.TestEnvVars.chartNameForACR]}:0.1.0`;
a.exec[helmChartPushCommand] = {
    "code": 0,
    "stdout": "Successfully pushed to the chart to container registry."
}

const helmChartRemoveCommand = `helm chart${formatDebugFlag()} remove ${process.env[shared.TestEnvVars.azureContainerRegistry]}/helm/${process.env[shared.TestEnvVars.chartNameForACR]}:0.1.0`;
a.exec[helmChartRemoveCommand] = {
    "code": 0,
    "stdout": "Successfully removed the chart from local cache."
}

tr.setAnswers(<any>a);
tr.registerMock("azure-pipelines-task-lib/toolrunner", require("azure-pipelines-task-lib/mock-toolrunner"));


// Create mocks for required modules
import * as fs from 'fs';
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function (path, data) {
    console.log(`wrote to ${path}`);
};
fsClone.chmodSync = function (path, mode) {
    console.log(`changed mode of file at ${path} to ${mode}`);
};
tr.registerMock('fs', fsClone);

import * as util from '../src/utils';
tr.registerMock('../src/utils', {

    getTaskTempDir: function () {
        return path.join("tempdirectory", "helmTask");
    },
    getTempDirectory: function () {
        return "tempdirectory";
    },
    deleteFile: function (path: string) {
        console.log(`${path} deleted`);
    },
    getCurrentTime: util.getCurrentTime,
    resolvePath: util.resolvePath,
    extractReleaseNameFromHelmOutput: util.extractReleaseNameFromHelmOutput,
    getManifestsFromRelease: util.getManifestsFromRelease,
    getHelmPathForACR: util.getHelmPathForACR
});

import * as webUtil from 'azure-pipelines-tasks-utility-common/restutilities';
import { command } from 'azure-pipelines-task-lib';
tr.registerMock('azure-pipelines-tasks-utility-common/restutilities', {
    WebRequest: webUtil.WebRequest,
    WebResponse: webUtil.WebResponse,
    sendRequest: async function (request: webUtil.WebRequest) {
        console.log("Mock request sent");
        return { "mockKey": "mockValue" };
    }
})

tr.run();
