import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import * as shared from './TestShared';

const DefaultWorkingDirectory: string = shared.formatPath("a/w");
const ConfigurationFilePath = shared.formatPath("dir/deployment.yaml");
const newUserDirPath = shared.formatPath("newUserDir/");
const KubconfigFile = shared.formatPath("newUserDir/config");
const KubectlPath = shared.formatPath("newUserDir/kubectl.exe");

let taskPath = path.join(__dirname, '../src', 'kubernetes.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerregistrytype', process.env[shared.TestEnvVars.containerType] || shared.ContainerTypes.ContainerRegistry);
tr.setInput('command', process.env[shared.TestEnvVars.command] || shared.Commands.apply);
tr.setInput('useConfigurationFile', process.env[shared.TestEnvVars.useConfigurationFile] || "false");
tr.setInput('configuration', ConfigurationFilePath);
tr.setInput('namespace', process.env[shared.TestEnvVars.namespace] || '');
tr.setInput('forceUpdate', process.env[shared.TestEnvVars.forceUpdate] || "true");
tr.setInput('versionOrLocation', process.env[shared.TestEnvVars.versionOrLocation] || 'version');
tr.setInput('versionSpec', process.env[shared.TestEnvVars.versionSpec] || "1.7.0");
tr.setInput('checkLatest', process.env[shared.TestEnvVars.checkLatest] || "false");
tr.setInput('specifyLocation', process.env[shared.TestEnvVars.specifyLocation] || "");

tr.setInput('dockerRegistryEndpoint', 'dockerhubendpoint');
tr.setInput('kubernetesServiceEndpoint', 'kubernetesEndpoint');
tr.setInput('azureSubscriptionEndpoint', 'AzureRMSpn');
tr.setInput('azureContainerRegistry', '{"loginServer":"ajgtestacr1.azurecr.io", "id" : "/subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/ajgtestacr1rg/providers/Microsoft.ContainerRegistry/registries/ajgtestacr1"}')
tr.setInput('secretName', process.env[shared.TestEnvVars.secretName] || '');
tr.setInput('arguments', process.env[shared.TestEnvVars.arguments] || '');
tr.setInput('outputFormat', process.env[shared.TestEnvVars.outputFormat] || 'json');
tr.setInput('kubectlOutput', process.env[shared.TestEnvVars.kubectlOutput] || '');
console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"test\", \"password\":\"regpassword\", \"email\":\"test@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_kubernetesEndpoint"] = "{\"parameters\":{\"kubeconfig\":\"kubeconfig\", \"username\":\"test\", \"password\":\"regpassword\",},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_PARAMETER_kubernetesEndpoint_KUBECONFIG"] =  "{\"apiVersion\":\"v1\", \"clusters\": [{\"cluster\": {\"insecure-skip-tls-verify\":\"true\", \"server\":\"https://5.6.7.8\", \"name\" : \"scratch\"}}], \"contexts\": [{\"context\" : {\"cluster\": \"scratch\", \"namespace\" : \"default\", \"user\": \"experimenter\", \"name\" : \"exp-scratch\"}], \"current-context\" : \"exp-scratch\", \"kind\": \"Config\", \"users\" : [{\"user\": {\"password\": \"regpassword\", \"username\" : \"test\"}]}";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";

// provide answers for task mock
let a = {
    "which" : {
    },
     "checkPath": {
        [KubectlPath]: true,
        [ConfigurationFilePath]: true
    },
    "exist": {
        [ConfigurationFilePath]: true
    },
    "exec": {
    }
};

// Add extra answer definitions that need to be dynamically generated
a.exist[ConfigurationFilePath] = true;
a.exist[KubconfigFile] = true;
a.exist[KubectlPath] = true;

if (JSON.parse(process.env[shared.isKubectlPresentOnMachine]))
{
    a.which["kubectl"] = "kubectl";
    a.exist["kubectl"] = true;
    a.checkPath["kubectl"] = true;
}

a.exec[`${KubectlPath} --kubeconfig ${KubconfigFile} get pods`] = {
    "code": 0,
     "stdout": "successfully ran get pods command"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} apply -f ${ConfigurationFilePath}`] = {
    "code": 0,
    "stdout": "successfully applied the configuration deployment.yaml"
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} create secret generic my-secret --from-literal=key1=\"some value\"`] = {
    "code": 0,
    "stdout": "successfully ran the create command with the given arguments"
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} delete pod -all`] = {
    "code": 0,
    "stdout": "successfully deleted all pods"
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} exec nginx date`] = {
    "code": 0,
    "stdout": "successfully got the output from running date from pod nginx using exec command"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} expose -f ${ConfigurationFilePath} --port=80 --target-port=8000`] = {
    "code": 0,
    "stdout": "successfully created a service for deployment in deployment.yaml using expose command "
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} get pods`] = {
    "code": 0,
     "stdout": "successfully ran get pods command"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} get -n kube-system pods`] = {
    "code": 0,
    "stdout": "sucessfully fetched the pods in the namespace"
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} logs nginx`] = {
    "code": 0,
    "stdout": "successfully returned snapshot logs from pod nginx with only container"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} run nginx --image=nginx`] = {
    "code": 0,
    "stdout": "successfully started a single instance of nginx using run command"
}
a.exec[`kubectl --kubeconfig ${KubconfigFile} set env pods --all --list`] = {
    "code": 0,
    "stdout": "successfully listed the environment variables defined on all pods"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} top node`] = {
    "code": 0,
    "stdout": "successfully showed metrics for all nodes"
},
a.exec[`kubectl --kubeconfig ${KubconfigFile} delete secret my-secret`] = {
    "code": 0
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=spId --docker-password=spKey --docker-email=ServicePrincipal@AzureRM`] = {
    "code": 0
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`] = {
    "code": 0
};
a.exec[`kubectl --kubeconfig ${KubconfigFile} get secrets my-secret -o yaml`] = {
    "code": 0,
    "stdout": "successfully got secret my-secret and printed it in the specified format"
};

tr.setAnswers(<any>a);

// Create mock for fs module
let fs = require('fs');
let fsClone = Object.assign({}, fs);
fsClone.existsSync = function(filePath) {
    switch (filePath) {
        case "kubectl":
            if(JSON.parse(process.env[shared.isKubectlPresentOnMachine]))
            {
                return true;
            }
            else
            {
                return false;
            } 
        case KubectlPath:
            return true;     
        case KubconfigFile:
            return true;
        case ConfigurationFilePath:
            return true;
        default:
            return fs.existsSync(filePath);
    }
};
fsClone.writeFileSync = function(fileName, data) {
    switch (fileName) {
        case KubconfigFile:
            console.log("Content of kubeconfig file : " + data); 
            break;
        default:
            return fs.writeFileSync(fileName, data);
    }
};

fsClone.chmod = function(path, mode) {
      switch(path){
          case KubectlPath:
            console.log("Added permissions to kubectlPath");
            break;
          default:
            fs.chmod(path, mode);        
      }
};
tr.registerMock('fs', fsClone);

var ut = require('../src/utilities');
tr.registerMock('./utilities', {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    PackerVersion: ut.PackerVersion,
    isGreaterVersion: ut.isGreaterVersion,
    getTempDirectory: function() {
        return newUserDirPath;
    },
    getCurrentTime: function() {
        return new Date(1996,3,5);
    },
    getNewUserDirPath: function() {
        return newUserDirPath;
    },
    getStableKubectlVersion: function(){
        return "v1.6.6";
    },
    getKubectlVersion: async function(versionSpec, checkLatest) : Promise<string> {
        let version: string = "v1.6.6";   

        if(checkLatest) {
            version = this.getStableKubectlVersion();
        }
        else if (versionSpec) {
            if(versionSpec === "1.7") {
                version = this.getStableKubectlVersion();
            } 
            else if(!versionSpec.startsWith("v")) {
                version = "v".concat(versionSpec);
            }
            else {
                version = versionSpec;
            } 
        }

        console.log("Got kubectl version " + version);
        return Promise.resolve(version);
    },
    downloadKubectl: function() {
        console.log("Downloaded kubectl");
        return KubectlPath;
    },
    assertFileExists: function(path) {
        return true;
    }    
});

tr.run();