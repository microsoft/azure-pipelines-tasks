import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

import * as shared from './TestShared';

const buildNumber = '1';
const buildId = '1';
const teamProject = 'project1';
const collectionId = 'collection1';
const definitionName = 'test';
const definitionId = '123';
const teamFoundationCollectionUri = 'https://abc.visualstudio.com/';
const jobName = 'jobName';

const testnamespaceWorkingDirectory: string = shared.formatPath('a/w');
const kubectlPath = shared.formatPath('newUserDir/kubectl.exe');

const taskPath = path.join(__dirname, '../src', 'run.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('kubernetesServiceConnection', 'kubernetesConnection');
tr.setInput('namespace', process.env[shared.TestEnvVars.namespace] || '');
tr.setInput('action', process.env[shared.TestEnvVars.action] || 'deploy');
tr.setInput('strategy', process.env[shared.TestEnvVars.strategy] || 'None');
tr.setInput('percentage', process.env[shared.TestEnvVars.percentage] || '');
tr.setInput('manifests', process.env[shared.TestEnvVars.manifests] || shared.ManifestFilesPath);
tr.setInput('containers', process.env[shared.TestEnvVars.containers] || '');
tr.setInput('imagePullSecrets', process.env[shared.TestEnvVars.imagePullSecrets] || '');
tr.setInput('renderType', process.env[shared.TestEnvVars.renderType] || '');
tr.setInput('helmChart', process.env[shared.TestEnvVars.helmChart] || '');
tr.setInput('releaseName', process.env[shared.TestEnvVars.releaseName] || '');
tr.setInput('overrideFiles', process.env[shared.TestEnvVars.overrideFiles] || '');
tr.setInput('overrides', process.env[shared.TestEnvVars.overrides] || '');
tr.setInput('resourceToPatch', process.env[shared.TestEnvVars.resourceToPatch] || '');
tr.setInput('resourceFileToPatch', process.env[shared.TestEnvVars.resourceFileToPatch] || '');
tr.setInput('kind', process.env[shared.TestEnvVars.kind] || '');
tr.setInput('name', process.env[shared.TestEnvVars.name] || '');
tr.setInput('replicas', process.env[shared.TestEnvVars.replicas] || '');
tr.setInput('mergeStrategy', process.env[shared.TestEnvVars.mergeStrategy] || '');
tr.setInput('arguments', process.env[shared.TestEnvVars.arguments] || '');
tr.setInput('patch', process.env[shared.TestEnvVars.patch] || '');
tr.setInput('secretName', process.env[shared.TestEnvVars.secretName] || '');
tr.setInput('secretType', process.env[shared.TestEnvVars.secretType] || '');
tr.setInput('dockerComposeFile', process.env[shared.TestEnvVars.dockerComposeFile] || '');
tr.setInput('kustomizationPath', process.env[shared.TestEnvVars.kustomizationPath] || '');
tr.setInput('baselineAndCanaryReplicas', process.env[shared.TestEnvVars.baselineAndCanaryReplicas] || '0');
tr.setInput('trafficSplitMethod', process.env[shared.TestEnvVars.trafficSplitMethod]);

process.env.SYSTEM_DEFAULTWORKINGDIRECTORY = testnamespaceWorkingDirectory;
process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = teamFoundationCollectionUri;
process.env.SYSTEM_TEAMPROJECT = teamProject;
process.env.SYSTEM_COLLECTIONID = collectionId;
process.env.SYSTEM_DEFINITIONID = definitionId;

process.env.BUILD_BUILDID = buildId;
process.env.BUILD_BUILDNUMBER = buildNumber;
process.env.BUILD_DEFINITIONNAME = definitionName;

process.env.AGENT_JOBNAME = jobName;
process.env.SYSTEM_HOSTTYPE = 'build';

process.env[shared.TestEnvVars.manifests] = process.env[shared.TestEnvVars.manifests] || shared.ManifestFilesPath;
process.env.ENDPOINT_DATA_kubernetesConnection_AUTHORIZATIONTYPE = process.env[shared.TestEnvVars.endpointAuthorizationType] || shared.AuthorizationType.Kubeconfig;
process.env.ENDPOINT_AUTH_PARAMETER_kubernetesConnection_KUBECONFIG = '{"apiVersion":"v1", "clusters": [{"cluster": {"insecure-skip-tls-verify":"true", "server":"https://5.6.7.8", "name" : "scratch"}}], "contexts": [{"context" : {"cluster": "scratch", "namespace" : "default", "user": "experimenter", "name" : "exp-scratch"}], "current-context" : "exp-scratch", "kind": "Config", "users" : [{"user": {"password": "regpassword", "username" : "test"}]}';

process.env.ENDPOINT_DATA_kubernetesConnection_NAMESPACE = 'testnamespace';

if (process.env.RemoveNamespaceFromEndpoint) {
    process.env.ENDPOINT_DATA_kubernetesConnection_NAMESPACE = '';
}

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'helm': true,
        'kompose': true,
        'dockerComposeFilePath': true
    },
    'exec': {
    },
    'findMatch': {},
    'which': {
        'helm': 'helm',
        'kompose': 'kompose'
    }
};

if (process.env[shared.TestEnvVars.action] === 'bake') {
    let namespace = process.env[shared.TestEnvVars.namespace] || 'testnamespace';
    if (process.env.RemoveNamespaceFromEndpoint) {
        namespace = 'default';
    }
    const command = `helm template ${process.env[shared.TestEnvVars.helmChart]} --namespace ${namespace}`;
    const commandWithReleaseNameOverride = `helm template ${process.env[shared.TestEnvVars.helmChart]} --name ${process.env[shared.TestEnvVars.releaseName]} --namespace ${namespace}`;
    const commandWithReleaseNameOverride3 = `helm template ${process.env[shared.TestEnvVars.releaseName]} ${process.env[shared.TestEnvVars.helmChart]} --namespace ${namespace}`;

    a.exec[command] = {
        'code': 0,
        stdout: 'baked manifest from helm chart'
    };
    a.exec[commandWithReleaseNameOverride] = {
        'code': 0,
        stdout: 'baked manifest from helm chart'
    };
    a.exec[commandWithReleaseNameOverride3] = {
        'code': 0,
        stdout: 'baked manifest from helm chart'
    };
    a.exec[`helm template ${process.env[shared.TestEnvVars.helmChart]} --namespace ${namespace} --set name=value:with:colons`] = {
        'code': 0,
        stdout: 'baked manifest from helm chart'
    };

    const kubectlVersion = `${kubectlPath} version --client=true -o json`;
    a.exec[kubectlVersion] = {
        'code': 0,
        stdout: `{
            "clientVersion": {
              "major": "1",
              "minor": ${process.env.KubectlMinorVersion},
              "gitVersion": "v1.13.0"
            }
          }`
    };

    const kustomizeCommand = `${kubectlPath} kustomize ${process.env[shared.TestEnvVars.kustomizationPath]}`;
    a.exec[kustomizeCommand] = {
        'code': 0,
        stdout: 'Kustomization files created'
    };

    const komposeCommand = `kompose convert -f ${process.env[shared.TestEnvVars.dockerComposeFile]} -o ${path.join('tempdirectory', 'baked-template-random.yaml')}`;
    a.exec[komposeCommand] = {
        'code': 0,
        stdout: 'Kubernetes files created'
    };
}

const helmVersionCommand = 'helm version --short';
if (process.env[shared.TestEnvVars.helmVersion] === 'v3') {
    a.exec[helmVersionCommand] = {
        'code': 0,
        stdout: 'v3.0.0+ge29ce2a'
    };
} else {
    a.exec[helmVersionCommand] = {
        'code': 0,
        stdout: 'v2.0.0+da768e'
    };
}

if (process.env[shared.TestEnvVars.isKubectlPresentOnMachine] && JSON.parse(process.env[shared.TestEnvVars.isKubectlPresentOnMachine])) {
    a.which.kubectl = kubectlPath;
}

a.checkPath[kubectlPath] = true;
a.findMatch[process.env[shared.TestEnvVars.manifests]] = [process.env[shared.TestEnvVars.manifests]];

if (process.env[shared.TestEnvVars.isStableDeploymentPresent] && JSON.parse(process.env[shared.TestEnvVars.isStableDeploymentPresent])) {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment -o json --namespace testnamespace`] = {
        'code': 0,
        'stdout': '{"apiVersion": "extensions\/v1beta1",\r\n    "kind": "Deployment",\r\n    "metadata": {\r\n        "annotations": {\r\n            "azure-pipelines\/run": "11937a13",\r\n            "azure-pipelines\/runuri": "http:\/\/nishu-65\/DefaultCollection\/_build\/results?buildId=11937a13b667c4bc609ac98dde4c4d10cbd1f499",\r\n            "azure-pipelines\/org": "51050983-0664-4716-9ac7-6b6e6ea7e5e8",\r\n            "azure-pipelines\/pipeline": "\\"project1\\"",\r\n            "azure-pipelines\/project": "project1",\r\n            "deployment.kubernetes.io\/revision": "1",\r\n            "kubectl.kubernetes.io\/last-applied-configuration": "{\\"apiVersion\\":\\"apps\/v1\\",\\"kind\\":\\"Deployment\\",\\"metadata\\":{\\"annotations\\":{},\\"labels\\":{\\"app\\":\\"nginx\\"},\\"name\\":\\"nginx-deployment\\",\\"namespace\\":\\"default\\"},\\"spec\\":{\\"replicas\\":3,\\"selector\\":{\\"matchLabels\\":{\\"app\\":\\"nginx\\"}},\\"template\\":{\\"metadata\\":{\\"labels\\":{\\"app\\":\\"nginx\\"}},\\"spec\\":{\\"containers\\":[{\\"image\\":\\"nginx:1.7.9\\",\\"name\\":\\"nginx\\",\\"ports\\":[{\\"containerPort\\":80}]}]}}}}\\n"\r\n        },\r\n        "creationTimestamp": "2019-03-22T13:10:38Z",\r\n        "generation": 2,\r\n        "labels": {\r\n            "app": "nginx"\r\n        },\r\n        "name": "nginx-deployment",\r\n        "namespace": "default",\r\n        "resourceVersion": "125935",\r\n        "selfLink": "\/apis\/extensions\/v1beta1\/namespaces\/default\/deployments\/nginx-deployment",\r\n        "uid": "e2e3e6c2-4ca3-11e9-bdff-2a073485f16f"\r\n    },\r\n    "spec": {\r\n        "progressDeadlineSeconds": 600,\r\n        "replicas": 3,\r\n        "revisionHistoryLimit": 10,\r\n        "selector": {\r\n            "matchLabels": {\r\n                "app": "nginx"\r\n            }\r\n        },\r\n        "strategy": {\r\n            "rollingUpdate": {\r\n                "maxSurge": "25%",\r\n                "maxUnavailable": "25%"\r\n            },\r\n            "type": "RollingUpdate"\r\n        },\r\n        "template": {\r\n            "metadata": {\r\n                "creationTimestamp": null,\r\n                "labels": {\r\n                    "app": "nginx"\r\n                }\r\n            },\r\n            "spec": {\r\n                "containers": [\r\n                    {\r\n                        "image": "nginx:1.7.9",\r\n                        "imagePullPolicy": "IfNotPresent",\r\n                        "name": "nginx",\r\n                        "ports": [\r\n                            {\r\n                                "containerPort": 80,\r\n                                "protocol": "TCP"\r\n                            }\r\n                        ],\r\n                        "resources": {},\r\n                        "terminationMessagePath": "\/dev\/termination-log",\r\n                        "terminationMessagePolicy": "File"\r\n                    }\r\n                ],\r\n                "dnsPolicy": "ClusterFirst",\r\n                "restartPolicy": "Always",\r\n                "schedulerName": "default-scheduler",\r\n                "securityContext": {},\r\n                "terminationGracePeriodSeconds": 30\r\n            }\r\n        }\r\n    },\r\n    "status": {\r\n        "availableReplicas": 3,\r\n        "conditions": [\r\n            {\r\n                "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n                "lastUpdateTime": "2019-03-22T13:10:55Z",\r\n                "message": "ReplicaSet \\"nginx-deployment-5c689d88bb\\" has successfully progressed.",\r\n                "reason": "NewReplicaSetAvailable",\r\n                "status": "True",\r\n                "type": "Progressing"\r\n            },\r\n            {\r\n                "lastTransitionTime": "2019-03-23T01:31:12Z",\r\n                "lastUpdateTime": "2019-03-23T01:31:12Z",\r\n                "message": "Deployment has minimum availability.",\r\n                "reason": "MinimumReplicasAvailable",\r\n                "status": "True",\r\n                "type": "Available"\r\n            }\r\n        ],\r\n        "observedGeneration": 2,\r\n        "readyReplicas": 3,\r\n        "replicas": 3,\r\n        "updatedReplicas": 3\r\n    }\r\n}\r\n'
    };
} else {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment -o json --namespace testnamespace`] = {
        'code': 1,
        'stderr': 'Error from server (NotFound): deployments.extensions "nginx-deployment" not found'
    };
}

if (process.env[shared.TestEnvVars.isCanaryDeploymentPresent] && JSON.parse(process.env[shared.TestEnvVars.isCanaryDeploymentPresent])) {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment-canary -o json --namespace testnamespace`] = {
        'code': 0,
        'stdout': '{\r\n  "apiVersion": "extensions/v1beta1",\r\n  "kind": "Deployment",\r\n  "metadata": {\r\n    "annotations": {\r\n      "azure-pipelines/run": "11937a13",\r\n      "azure-pipelines/runuri": "http://nishu-65/DefaultCollection/_build/results?buildId=11937a13b667c4bc609ac98dde4c4d10cbd1f499",\r\n      "azure-pipelines/org": "51050983-0664-4716-9ac7-6b6e6ea7e5e8",\r\n      "azure-pipelines/pipeline": "\\"project1\\"",\r\n      "azure-pipelines/project": "project1",\r\n      "azure-pipelines/version": "canary",\r\n      "deployment.kubernetes.io/revision": "1",\r\n      "kubectl.kubernetes.io/last-applied-configuration": "{\\"apiVersion\\":\\"apps/v1\\",\\"kind\\":\\"Deployment\\",\\"metadata\\":{\\"annotations\\":{\\"azure-pipelines/version\\":\\"canary\\"},\\"labels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"canary\\"},\\"name\\":\\"nginx-deployment-canary\\",\\"namespace\\":\\"default\\"},\\"spec\\":{\\"replicas\\":1,\\"selector\\":{\\"matchLabels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"canary\\"}},\\"template\\":{\\"metadata\\":{\\"labels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"canary\\"}},\\"spec\\":{\\"containers\\":[{\\"image\\":\\"nginx:1.7.9\\",\\"name\\":\\"nginx\\",\\"ports\\":[{\\"containerPort\\":80}]}]}}}}\\n"\r\n    },\r\n    "creationTimestamp": "2019-03-28T08:36:36Z",\r\n    "generation": 2,\r\n    "labels": {\r\n      "app": "nginx",\r\n      "azure-pipelines/version": "canary"\r\n    },\r\n    "name": "nginx-deployment-canary",\r\n    "namespace": "default",\r\n    "resourceVersion": "911614",\r\n    "selfLink": "/apis/extensions/v1beta1/namespaces/default/deployments/nginx-deployment-canary",\r\n    "uid": "9949c869-5134-11e9-8617-8a66bb81ec3a"\r\n  },\r\n  "spec": {\r\n    "progressDeadlineSeconds": 600,\r\n    "replicas": 1,\r\n    "revisionHistoryLimit": 10,\r\n    "selector": {\r\n      "matchLabels": {\r\n        "app": "nginx",\r\n        "azure-pipelines/version": "canary"\r\n      }\r\n    },\r\n    "strategy": {\r\n      "rollingUpdate": {\r\n        "maxSurge": "25%",\r\n        "maxUnavailable": "25%"\r\n      },\r\n      "type": "RollingUpdate"\r\n    },\r\n    "template": {\r\n      "metadata": {\r\n        "creationTimestamp": null,\r\n        "labels": {\r\n          "app": "nginx",\r\n          "azure-pipelines/version": "canary"\r\n        }\r\n      },\r\n      "spec": {\r\n        "containers": [\r\n          {\r\n            "image": "nginx:1.7.9",\r\n            "imagePullPolicy": "IfNotPresent",\r\n            "name": "nginx",\r\n            "ports": [\r\n              {\r\n                "containerPort": 80,\r\n                "protocol": "TCP"\r\n              }\r\n            ],\r\n            "resources": {},\r\n            "terminationMessagePath": "/dev/termination-log",\r\n            "terminationMessagePolicy": "File"\r\n          }\r\n        ],\r\n        "dnsPolicy": "ClusterFirst",\r\n        "restartPolicy": "Always",\r\n        "schedulerName": "default-scheduler",\r\n        "securityContext": {},\r\n        "terminationGracePeriodSeconds": 30\r\n      }\r\n    }\r\n  },\r\n  "status": {\r\n    "availableReplicas": 1,\r\n    "conditions": [\r\n      {\r\n        "lastTransitionTime": "2019-03-28T08:36:40Z",\r\n        "lastUpdateTime": "2019-03-28T08:36:40Z",\r\n        "message": "Deployment has minimum availability.",\r\n        "reason": "MinimumReplicasAvailable",\r\n        "status": "True",\r\n        "type": "Available"\r\n      },\r\n      {\r\n        "lastTransitionTime": "2019-03-28T08:36:36Z",\r\n        "lastUpdateTime": "2019-03-28T08:36:40Z",\r\n        "message": "ReplicaSet \\"nginx-deployment-canary-6b967f76d6\\" has successfully progressed.",\r\n        "reason": "NewReplicaSetAvailable",\r\n        "status": "True",\r\n        "type": "Progressing"\r\n      }\r\n    ],\r\n    "observedGeneration": 2,\r\n    "readyReplicas": 1,\r\n    "replicas": 1,\r\n    "updatedReplicas": 1\r\n  }\r\n}'
    };
} else {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment-canary -o json --namespace testnamespace`] = {
        'code': 1,
        'stderr': 'Error from server (NotFound): deployments.extensions "nginx-deployment-canary" not found'
    };
}

if (process.env[shared.TestEnvVars.isBaselineDeploymentPresent] && JSON.parse(process.env[shared.TestEnvVars.isBaselineDeploymentPresent])) {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment-baseline -o json --namespace testnamespace`] = {
        'code': 0,
        'stdout': '{\r\n  "apiVersion": "extensions/v1beta1",\r\n  "kind": "Deployment",\r\n  "metadata": {\r\n    "annotations": {\r\n      "azure-pipelines/run": "11937a13",\r\n      "azure-pipelines/runuri": "http://nishu-65/DefaultCollection/_build/results?buildId=11937a13b667c4bc609ac98dde4c4d10cbd1f499",\r\n      "azure-pipelines/org": "51050983-0664-4716-9ac7-6b6e6ea7e5e8",\r\n      "azure-pipelines/pipeline": "\\"project1\\"",\r\n      "azure-pipelines/project": "project1",\r\n      "azure-pipelines/version": "baseline",\r\n      "deployment.kubernetes.io/revision": "1",\r\n      "kubectl.kubernetes.io/last-applied-configuration": "{\\"apiVersion\\":\\"apps/v1\\",\\"kind\\":\\"Deployment\\",\\"metadata\\":{\\"annotations\\":{\\"azure-pipelines/version\\":\\"baseline\\"},\\"labels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"baseline\\"},\\"name\\":\\"nginx-deployment-baseline\\",\\"namespace\\":\\"default\\"},\\"spec\\":{\\"replicas\\":1,\\"selector\\":{\\"matchLabels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"baseline\\"}},\\"template\\":{\\"metadata\\":{\\"labels\\":{\\"app\\":\\"nginx\\",\\"azure-pipelines/version\\":\\"baseline\\"}},\\"spec\\":{\\"containers\\":[{\\"image\\":\\"nginx:1.7.9\\",\\"name\\":\\"nginx\\",\\"ports\\":[{\\"containerPort\\":80}]}]}}}}\\n"\r\n    },\r\n    "creationTimestamp": "2019-03-28T08:36:36Z",\r\n    "generation": 2,\r\n    "labels": {\r\n      "app": "nginx",\r\n      "azure-pipelines/version": "baseline"\r\n    },\r\n    "name": "nginx-deployment-baseline",\r\n    "namespace": "default",\r\n    "resourceVersion": "911614",\r\n    "selfLink": "/apis/extensions/v1beta1/namespaces/default/deployments/nginx-deployment-baseline",\r\n    "uid": "9949c869-5134-11e9-8617-8a66bb81ec3a"\r\n  },\r\n  "spec": {\r\n    "progressDeadlineSeconds": 600,\r\n    "replicas": 1,\r\n    "revisionHistoryLimit": 10,\r\n    "selector": {\r\n      "matchLabels": {\r\n        "app": "nginx",\r\n        "azure-pipelines/version": "baseline"\r\n      }\r\n    },\r\n    "strategy": {\r\n      "rollingUpdate": {\r\n        "maxSurge": "25%",\r\n        "maxUnavailable": "25%"\r\n      },\r\n      "type": "RollingUpdate"\r\n    },\r\n    "template": {\r\n      "metadata": {\r\n        "creationTimestamp": null,\r\n        "labels": {\r\n          "app": "nginx",\r\n          "azure-pipelines/version": "baseline"\r\n        }\r\n      },\r\n      "spec": {\r\n        "containers": [\r\n          {\r\n            "image": "nginx:1.7.9",\r\n            "imagePullPolicy": "IfNotPresent",\r\n            "name": "nginx",\r\n            "ports": [\r\n              {\r\n                "containerPort": 80,\r\n                "protocol": "TCP"\r\n              }\r\n            ],\r\n            "resources": {},\r\n            "terminationMessagePath": "/dev/termination-log",\r\n            "terminationMessagePolicy": "File"\r\n          }\r\n        ],\r\n        "dnsPolicy": "ClusterFirst",\r\n        "restartPolicy": "Always",\r\n        "schedulerName": "default-scheduler",\r\n        "securityContext": {},\r\n        "terminationGracePeriodSeconds": 30\r\n      }\r\n    }\r\n  },\r\n  "status": {\r\n    "availableReplicas": 1,\r\n    "conditions": [\r\n      {\r\n        "lastTransitionTime": "2019-03-28T08:36:40Z",\r\n        "lastUpdateTime": "2019-03-28T08:36:40Z",\r\n        "message": "Deployment has minimum availability.",\r\n        "reason": "MinimumReplicasAvailable",\r\n        "status": "True",\r\n        "type": "Available"\r\n      },\r\n      {\r\n        "lastTransitionTime": "2019-03-28T08:36:36Z",\r\n        "lastUpdateTime": "2019-03-28T08:36:40Z",\r\n        "message": "ReplicaSet \\"nginx-deployment-baseline-6b967f76d6\\" has successfully progressed.",\r\n        "reason": "NewReplicaSetAvailable",\r\n        "status": "True",\r\n        "type": "Progressing"\r\n      }\r\n    ],\r\n    "observedGeneration": 2,\r\n    "readyReplicas": 1,\r\n    "replicas": 1,\r\n    "updatedReplicas": 1\r\n  }\r\n}'
    };
} else {
    a.exec[`${kubectlPath} get Deployment/nginx-deployment-baseline -o json --namespace testnamespace`] = {
        'code': 1,
        'stderr': 'Error from server (NotFound): deployments.extensions nginx-deployment-baseline not found'
    };
}

a.exec[`${kubectlPath} apply -f ${process.env[shared.TestEnvVars.manifests]} --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'deployment.apps/nginx-deployment created.'
};

a.exec[`${kubectlPath} apply -f ${shared.CanaryManifestFilesPath},${shared.BaselineManifestFilesPath} --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'deployment.apps/nginx-deployment-canary created. deployment.extensions/nginx-deployment-baseline created '
};

a.exec[`${kubectlPath} rollout status Deployment/nginx-deployment --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'deployment "nginx-deployment" successfully rolled out'
};

a.exec[`${kubectlPath} rollout status Deployment/nginx-deployment-canary --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'deployment "nginx-deployment-canary" successfully rolled out'
};

a.exec[`${kubectlPath} rollout status Deployment/nginx-deployment-baseline --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'deployment "nginx-deployment-baseline" successfully rolled out'
};

a.exec[`${kubectlPath} rollout status ${process.env[shared.TestEnvVars.kind]}/${process.env[shared.TestEnvVars.name]} --namespace testnamespace`] = {
    'code': 0,
    'stdout': `${process.env[shared.TestEnvVars.kind]} "${process.env[shared.TestEnvVars.name]}" successfully rolled out`
};

a.exec[`${kubectlPath} patch ${process.env[shared.TestEnvVars.kind]} ${process.env[shared.TestEnvVars.name]} --type=${process.env[shared.TestEnvVars.mergeStrategy]} -p ${process.env[shared.TestEnvVars.patch]} --namespace ${process.env[shared.TestEnvVars.namespace] || 'testnamespace'}`] = {
    'code': 0,
    'stdout': `${process.env[shared.TestEnvVars.kind]}/${process.env[shared.TestEnvVars.name]} patched`
};

a.exec[`${kubectlPath} get pods -o json --namespace testnamespace`] = {
    'code': 0,
    'stdout': '{\r\n  "apiVersion": "v1",\r\n  "kind": "List",\r\n  "metadata": {\r\n    "resourceVersion": "",\r\n    "selfLink": ""\r\n  },\r\n  "items": [\r\n    {\r\n      "apiVersion": "v1",\r\n      "kind": "Pod",\r\n      "metadata": {\r\n        "creationTimestamp": "2019-03-22T13:10:38Z",\r\n        "generateName": "nginx-deployment-5c689d88bb-",\r\n        "labels": {\r\n          "app": "nginx",\r\n          "pod-template-hash": "5c689d88bb"\r\n        },\r\n        "name": "nginx-deployment-5c689d88bb-btlgf",\r\n        "namespace": "default",\r\n        "ownerReferences": [\r\n          {\r\n            "apiVersion": "apps\/v1",\r\n            "blockOwnerDeletion": true,\r\n            "controller": true,\r\n            "kind": "ReplicaSet",\r\n            "name": "nginx-deployment-5c689d88bb",\r\n            "uid": "e2e6b9b8-4ca3-11e9-bdff-2a073485f16f"\r\n          }\r\n        ],\r\n        "resourceVersion": "49418",\r\n        "selfLink": "\/api\/v1\/namespaces\/default\/pods\/nginx-deployment-5c689d88bb-btlgf",\r\n        "uid": "e2f4690c-4ca3-11e9-bdff-2a073485f16f"\r\n      },\r\n      "spec": {\r\n        "containers": [\r\n          {\r\n            "env": [\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP_ADDR",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_SERVICE_HOST",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              }\r\n            ],\r\n            "image": "nginx:1.7.9",\r\n            "imagePullPolicy": "IfNotPresent",\r\n            "name": "nginx",\r\n            "ports": [\r\n              {\r\n                "containerPort": 80,\r\n                "protocol": "TCP"\r\n              }\r\n            ],\r\n            "resources": {},\r\n            "terminationMessagePath": "\/dev\/termination-log",\r\n            "terminationMessagePolicy": "File",\r\n            "volumeMounts": [\r\n              {\r\n                "mountPath": "\/var\/run\/secrets\/kubernetes.io\/serviceaccount",\r\n                "name": "default-token-rcrjf",\r\n                "readOnly": true\r\n              }\r\n            ]\r\n          }\r\n        ],\r\n        "dnsPolicy": "ClusterFirst",\r\n        "nodeName": "aks-agentpool-14980324-0",\r\n        "priority": 0,\r\n        "restartPolicy": "Always",\r\n        "schedulerName": "default-scheduler",\r\n        "securityContext": {},\r\n        "serviceAccount": "default",\r\n        "serviceAccountName": "default",\r\n        "terminationGracePeriodSeconds": 30,\r\n        "tolerations": [\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/not-ready",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          },\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/unreachable",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          }\r\n        ],\r\n        "volumes": [\r\n          {\r\n            "name": "default-token-rcrjf",\r\n            "secret": {\r\n              "defaultMode": 420,\r\n              "secretName": "default-token-rcrjf"\r\n            }\r\n          }\r\n        ]\r\n      },\r\n      "status": {\r\n        "conditions": [\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "Initialized"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:54Z",\r\n            "status": "True",\r\n            "type": "Ready"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:54Z",\r\n            "status": "True",\r\n            "type": "ContainersReady"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "PodScheduled"\r\n          }\r\n        ],\r\n        "containerStatuses": [\r\n          {\r\n            "containerID": "docker:\/\/5e87acbad211218f3b1e383f2a83bc300095a032e87540c201e8e413b0518eeb",\r\n            "image": "nginx:1.7.9",\r\n            "imageID": "docker-pullable:\/\/nginx@sha256:e3456c851a152494c3e4ff5fcc26f240206abac0c9d794affb40e0714846c451",\r\n            "lastState": {},\r\n            "name": "nginx",\r\n            "ready": true,\r\n            "restartCount": 0,\r\n            "state": {\r\n              "running": {\r\n                "startedAt": "2019-03-22T13:10:53Z"\r\n              }\r\n            }\r\n          }\r\n        ],\r\n        "hostIP": "10.240.0.4",\r\n        "phase": "Running",\r\n        "podIP": "10.240.0.15",\r\n        "qosClass": "BestEffort",\r\n        "startTime": "2019-03-22T13:10:38Z"\r\n      }\r\n    },\r\n    {\r\n      "apiVersion": "v1",\r\n      "kind": "Pod",\r\n      "metadata": {\r\n        "creationTimestamp": "2019-03-22T13:10:38Z",\r\n        "generateName": "nginx-deployment-5c689d88bb-",\r\n        "labels": {\r\n          "app": "nginx",\r\n          "pod-template-hash": "5c689d88bb"\r\n        },\r\n        "name": "nginx-deployment-5c689d88bb-gnwrt",\r\n        "namespace": "default",\r\n        "ownerReferences": [\r\n          {\r\n            "apiVersion": "apps\/v1",\r\n            "blockOwnerDeletion": true,\r\n            "controller": true,\r\n            "kind": "ReplicaSet",\r\n            "name": "nginx-deployment-5c689d88bb",\r\n            "uid": "e2e6b9b8-4ca3-11e9-bdff-2a073485f16f"\r\n          }\r\n        ],\r\n        "resourceVersion": "125932",\r\n        "selfLink": "\/api\/v1\/namespaces\/default\/pods\/nginx-deployment-5c689d88bb-gnwrt",\r\n        "uid": "e2ece835-4ca3-11e9-bdff-2a073485f16f"\r\n      },\r\n      "spec": {\r\n        "containers": [\r\n          {\r\n            "env": [\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP_ADDR",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_SERVICE_HOST",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              }\r\n            ],\r\n            "image": "nginx:1.7.9",\r\n            "imagePullPolicy": "IfNotPresent",\r\n            "name": "nginx",\r\n            "ports": [\r\n              {\r\n                "containerPort": 80,\r\n                "protocol": "TCP"\r\n              }\r\n            ],\r\n            "resources": {},\r\n            "terminationMessagePath": "\/dev\/termination-log",\r\n            "terminationMessagePolicy": "File",\r\n            "volumeMounts": [\r\n              {\r\n                "mountPath": "\/var\/run\/secrets\/kubernetes.io\/serviceaccount",\r\n                "name": "default-token-rcrjf",\r\n                "readOnly": true\r\n              }\r\n            ]\r\n          }\r\n        ],\r\n        "dnsPolicy": "ClusterFirst",\r\n        "nodeName": "aks-agentpool-14980324-1",\r\n        "priority": 0,\r\n        "restartPolicy": "Always",\r\n        "schedulerName": "default-scheduler",\r\n        "securityContext": {},\r\n        "serviceAccount": "default",\r\n        "serviceAccountName": "default",\r\n        "terminationGracePeriodSeconds": 30,\r\n        "tolerations": [\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/not-ready",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          },\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/unreachable",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          }\r\n        ],\r\n        "volumes": [\r\n          {\r\n            "name": "default-token-rcrjf",\r\n            "secret": {\r\n              "defaultMode": 420,\r\n              "secretName": "default-token-rcrjf"\r\n            }\r\n          }\r\n        ]\r\n      },\r\n      "status": {\r\n        "conditions": [\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "Initialized"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:54Z",\r\n            "status": "True",\r\n            "type": "Ready"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:54Z",\r\n            "status": "True",\r\n            "type": "ContainersReady"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "PodScheduled"\r\n          }\r\n        ],\r\n        "containerStatuses": [\r\n          {\r\n            "containerID": "docker:\/\/a2bf617633e412760806e06e02dc5f81b5dad6f4f5ce8fe17955cdf72013ba04",\r\n            "image": "nginx:1.7.9",\r\n            "imageID": "docker-pullable:\/\/nginx@sha256:e3456c851a152494c3e4ff5fcc26f240206abac0c9d794affb40e0714846c451",\r\n            "lastState": {},\r\n            "name": "nginx",\r\n            "ready": true,\r\n            "restartCount": 0,\r\n            "state": {\r\n              "running": {\r\n                "startedAt": "2019-03-22T13:10:53Z"\r\n              }\r\n            }\r\n          }\r\n        ],\r\n        "hostIP": "10.240.0.35",\r\n        "phase": "Running",\r\n        "podIP": "10.240.0.43",\r\n        "qosClass": "BestEffort",\r\n        "startTime": "2019-03-22T13:10:38Z"\r\n      }\r\n    },\r\n    {\r\n      "apiVersion": "v1",\r\n      "kind": "Pod",\r\n      "metadata": {\r\n        "creationTimestamp": "2019-03-22T13:10:38Z",\r\n        "generateName": "nginx-deployment-5c689d88bb-",\r\n        "labels": {\r\n          "app": "nginx",\r\n          "pod-template-hash": "5c689d88bb"\r\n        },\r\n        "name": "nginx-deployment-5c689d88bb-qmh97",\r\n        "namespace": "default",\r\n        "ownerReferences": [\r\n          {\r\n            "apiVersion": "apps\/v1",\r\n            "blockOwnerDeletion": true,\r\n            "controller": true,\r\n            "kind": "ReplicaSet",\r\n            "name": "nginx-deployment-5c689d88bb",\r\n            "uid": "e2e6b9b8-4ca3-11e9-bdff-2a073485f16f"\r\n          }\r\n        ],\r\n        "resourceVersion": "49429",\r\n        "selfLink": "\/api\/v1\/namespaces\/default\/pods\/nginx-deployment-5c689d88bb-qmh97",\r\n        "uid": "e2f4630d-4ca3-11e9-bdff-2a073485f16f"\r\n      },\r\n      "spec": {\r\n        "containers": [\r\n          {\r\n            "env": [\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP_ADDR",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_PORT_443_TCP",\r\n                "value": "tcp:\/\/desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io:443"\r\n              },\r\n              {\r\n                "name": "KUBERNETES_SERVICE_HOST",\r\n                "value": "desattir-virtual-dns-9381c228.hcp.eastus.azmk8s.io"\r\n              }\r\n            ],\r\n            "image": "nginx:1.7.9",\r\n            "imagePullPolicy": "IfNotPresent",\r\n            "name": "nginx",\r\n            "ports": [\r\n              {\r\n                "containerPort": 80,\r\n                "protocol": "TCP"\r\n              }\r\n            ],\r\n            "resources": {},\r\n            "terminationMessagePath": "\/dev\/termination-log",\r\n            "terminationMessagePolicy": "File",\r\n            "volumeMounts": [\r\n              {\r\n                "mountPath": "\/var\/run\/secrets\/kubernetes.io\/serviceaccount",\r\n                "name": "default-token-rcrjf",\r\n                "readOnly": true\r\n              }\r\n            ]\r\n          }\r\n        ],\r\n        "dnsPolicy": "ClusterFirst",\r\n        "nodeName": "aks-agentpool-14980324-2",\r\n        "priority": 0,\r\n        "restartPolicy": "Always",\r\n        "schedulerName": "default-scheduler",\r\n        "securityContext": {},\r\n        "serviceAccount": "default",\r\n        "serviceAccountName": "default",\r\n        "terminationGracePeriodSeconds": 30,\r\n        "tolerations": [\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/not-ready",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          },\r\n          {\r\n            "effect": "NoExecute",\r\n            "key": "node.kubernetes.io\/unreachable",\r\n            "operator": "Exists",\r\n            "tolerationSeconds": 300\r\n          }\r\n        ],\r\n        "volumes": [\r\n          {\r\n            "name": "default-token-rcrjf",\r\n            "secret": {\r\n              "defaultMode": 420,\r\n              "secretName": "default-token-rcrjf"\r\n            }\r\n          }\r\n        ]\r\n      },\r\n      "status": {\r\n        "conditions": [\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "Initialized"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:55Z",\r\n            "status": "True",\r\n            "type": "Ready"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:55Z",\r\n            "status": "True",\r\n            "type": "ContainersReady"\r\n          },\r\n          {\r\n            "lastProbeTime": null,\r\n            "lastTransitionTime": "2019-03-22T13:10:38Z",\r\n            "status": "True",\r\n            "type": "PodScheduled"\r\n          }\r\n        ],\r\n        "containerStatuses": [\r\n          {\r\n            "containerID": "docker:\/\/3509c82a27b63f7fdb93746a74cb91862126c2cb66bae307904b2a89dcdf7152",\r\n            "image": "nginx:1.7.9",\r\n            "imageID": "docker-pullable:\/\/nginx@sha256:e3456c851a152494c3e4ff5fcc26f240206abac0c9d794affb40e0714846c451",\r\n            "lastState": {},\r\n            "name": "nginx",\r\n            "ready": true,\r\n            "restartCount": 0,\r\n            "state": {\r\n              "running": {\r\n                "startedAt": "2019-03-22T13:10:54Z"\r\n              }\r\n            }\r\n          }\r\n        ],\r\n        "hostIP": "10.240.0.66",\r\n        "phase": "Running",\r\n        "podIP": "10.240.0.79",\r\n        "qosClass": "BestEffort",\r\n        "startTime": "2019-03-22T13:10:38Z"\r\n      }\r\n    }\r\n  ]\r\n}'
};

a.exec[`${kubectlPath} describe deployment nginx-deployment --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'Name: nginx-deployment'
};

a.exec[`${kubectlPath} describe deployment nginx-deployment-canary --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'Name: nginx-deployment-canary'
};

a.exec[`${kubectlPath} describe deployment nginx-deployment-baseline --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'Name: nginx-deployment-baseline'
};

a.exec[`${kubectlPath} delete Deployment nginx-deployment-canary nginx-deployment-baseline --namespace testnamespace`] = {
    'code': 0,
    'stdout': ' "nginx-deployment-canary" deleted. "nginx-deployment-baseline" deleted'
};

a.exec[`${kubectlPath} delete Deployment nginx-deployment-canary --namespace testnamespace`] = {
    'code': 0,
    'stdout': ' "nginx-deployment-canary" deleted'
};

a.exec[`${kubectlPath} delete Deployment nginx-deployment-baseline --namespace testnamespace`] = {
    'code': 0,
    'stdout': ' "nginx-deployment-baseline" deleted'
};

a.exec[`${kubectlPath} delete secret secret --namespace testnamespace`] = {
    code: 0,
    stdout: 'deleted secret'
}

a.exec[`${kubectlPath} create secret generic secret --namespace testnamespace`] = {
    code: 0,
    stdout: 'created secret'
}

a.exec[`${kubectlPath} scale ${process.env[shared.TestEnvVars.kind]}/${process.env[shared.TestEnvVars.name]} --replicas=${process.env[shared.TestEnvVars.replicas]} --namespace testnamespace`] = {
    code: 0,
    stdout: 'created secret'
}

a.exec[`${kubectlPath} get service/nginx-service -o json --namespace testnamespace`] = {
    'code': 0,
    'stdout': '{\r\n     "apiVersion": "v1",\r\n     "kind": "Service",\r\n     "metadata": {\r\n         "annotations": {\r\n             "azure-pipelines/jobName": "Agent phase",\r\n             "azure-pipelines/org": "https://codedev.ms/anchauh/",\r\n             "azure-pipelines/pipeline": "aksCd-153 - 64 - CD",\r\n             "azure-pipelines/pipelineId": "40",\r\n             "azure-pipelines/project": "nginx",\r\n             "azure-pipelines/run": "41",\r\n             "azure-pipelines/runuri": "https://codedev.ms/anchauh/nginx/_releaseProgress?releaseId=41",\r\n             "kubectl.kubernetes.io/last-applied-configuration": "{\\"apiVersion\\":\\"v1\\",\\"kind\\":\\"Service\\",\\"metadata\\":{\\"annotations\\":{},\\"labels\\":{\\"app\\":\\"nginx\\"},\\"name\\":\\"nginx-service\\",\\"namespace\\":\\"testnamespace\\"},\\"spec\\":{\\"ports\\":[{\\"name\\":\\"http\\",\\"port\\":80,\\"protocol\\":\\"TCP\\",\\"targetPort\\":\\"http\\"}],\\"selector\\":{\\"app\\":\\"nginx\\"},\\"type\\":\\"LoadBalancer\\"}}\\n"\r\n         },\r\n         "creationTimestamp": "2019-09-11T10:09:09Z",\r\n         "labels": {\r\n             "app": "nginx"\r\n         },\r\n         "name": "nginx-service",\r\n         "namespace": "testnamespace",\r\n         "resourceVersion": "8754335",\r\n         "selfLink": "/api/v1/namespaces/testnamespace/services/nginx-service",\r\n         "uid": "31f02713-d47c-11e9-9448-16b93c17a2b4"\r\n     },\r\n     "spec": {\r\n         "clusterIP": "10.0.157.189",\r\n         "externalTrafficPolicy": "Cluster",\r\n         "ports": [\r\n             {\r\n                 "name": "http",\r\n                 "nodePort": 32112,\r\n                 "port": 80,\r\n                 "protocol": "TCP",\r\n                 "targetPort": "http"\r\n             }\r\n         ],\r\n         "selector": {\r\n             "app": "nginx"\r\n         },\r\n         "sessionAffinity": "***",\r\n         "type": "LoadBalancer"\r\n     },\r\n     "status": {\r\n         "loadBalancer": {\r\n             "ingress": [\r\n                 {\r\n                     "ip": "104.211.243.77"\r\n                 }\r\n             ]\r\n         }\r\n     }\r\n }'
}

a.exec[`${kubectlPath} version -o json --namespace testnamespace`] = {
    'code': 0,
    'stdout': '{\r\n  "clientVersion": {\r\n    "major": "1",\r\n    "minor": "14",\r\n    "gitVersion": "v1.14.8",\r\n    "gitCommit": "211047e9a1922595eaa3a1127ed365e9299a6c23",\r\n    "gitTreeState": "clean",\r\n    "buildDate": "2019-10-15T12:11:03Z",\r\n    "goVersion": "go1.12.10",\r\n    "compiler": "gc",\r\n    "platform": "windows/amd64"\r\n  },\r\n  "serverVersion": {\r\n    "major": "1",\r\n    "minor": "12",\r\n    "gitVersion": "v1.12.7",\r\n    "gitCommit": "6f482974b76db3f1e0f5d24605a9d1d38fad9a2b",\r\n    "gitTreeState": "clean",\r\n    "buildDate": "2019-03-25T02:41:57Z",\r\n    "goVersion": "go1.10.8",\r\n    "compiler": "gc",\r\n    "platform": "linux/amd64"\r\n  }\r\n}'
}

const pipelineAnnotations: string = [
    `azure-pipelines/run=${buildNumber}`,
    `azure-pipelines/pipeline="${definitionName}"`,
    `azure-pipelines/pipelineId="${definitionId}"`,
    `azure-pipelines/jobName="${jobName}"`,
    `azure-pipelines/runuri=${teamFoundationCollectionUri}${teamProject}/_build/results?buildId=${buildId}`,
    `azure-pipelines/project=${teamProject}`,
    `azure-pipelines/org=${teamFoundationCollectionUri}`
].join(' ');
const annotateCanaryCmd = `${kubectlPath} annotate -f ${shared.CanaryManifestFilesPath},${shared.BaselineManifestFilesPath} ` + pipelineAnnotations + ` --overwrite --namespace testnamespace`;

a.exec[annotateCanaryCmd] = {
    'code': 0,
    'stdout': 'deployment.apps/nginx-deployment-canary annotated. deployment.apps/nginx-deployment-baseline annotated'
};

a.exec[`${kubectlPath} annotate ${process.env[shared.TestEnvVars.kind]} ${process.env[shared.TestEnvVars.name]} ${pipelineAnnotations} --overwrite --namespace testnamespace`] = {
    'code': 0,
    'stdout': 'annotated'
};

const annotateStableCmd = `${kubectlPath} annotate -f ${process.env[shared.TestEnvVars.manifests]} ` + pipelineAnnotations + ` --overwrite --namespace testnamespace`;
a.exec[annotateStableCmd] = {
    'code': 0,
    'stdout': 'deployment.extensions/nginx-deployment annotated'
};

if (process.env[shared.TestEnvVars.arguments]) {
    const deleteCmd = `${kubectlPath} delete ${process.env[shared.TestEnvVars.arguments]} --namespace testnamespace`;
    a.exec[deleteCmd] = {
        'code': 0,
        'stdout': 'deleted successfuly'
    };
}


tr.setAnswers(<any>a);
tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

// Create mock for fs module
import * as fs from 'fs';
const fsClone = Object.assign({}, fs);
fsClone.existsSync = function (filePath) {
    switch (filePath) {
        case kubectlPath:
            if (JSON.parse(process.env[shared.TestEnvVars.isKubectlPresentOnMachine])) {
                return true;
            } else {
                return false;
            }
        default:
            return fs.existsSync(filePath);
    }
};

fsClone.writeFileSync = function (path, data) {
    console.log(`wrote to ${path}`);
};

tr.registerMock('fs', fsClone);

import * as fh from '../src/utils/FileHelper';

tr.registerMock('../utils/FileHelper', {
    writeObjectsToFile: function (inputObjects: any[]) {
        const newFilePaths = [];

        inputObjects.forEach(inputObject => {
            if (!!inputObject && !!inputObject.metadata && !!inputObject.metadata.name) {
                if (inputObject.metadata.name.indexOf('canary') !== -1) {
                    newFilePaths.push(shared.CanaryManifestFilesPath);
                } else if (inputObject.metadata.name.indexOf('baseline') !== -1) {
                    newFilePaths.push(shared.BaselineManifestFilesPath);
                }
            }
        });

        if (newFilePaths.length === 0) {
            console.log(shared.ManifestFilesPath);
            newFilePaths.push(shared.ManifestFilesPath);
        }
        return newFilePaths;
    },
    getTempDirectory: function () {
        return 'tempdirectory';
    },
    getNewUserDirPath: fh.getNewUserDirPath,
    ensureDirExists: fh.ensureDirExists,
    assertFileExists: fh.assertFileExists,
    writeManifestToFile: fh.writeManifestToFile
});

tr.registerMock('uuid/v4', function () {
    return 'random';
});

tr.run();
