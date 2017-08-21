import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import * as Q from 'q';
import * as shared from './TestShared';

const DefaultWorkingDirectory = "C:\\a\\w\\";
const ImageNamesPath = "C:\\agent\\_work\\1\\a\\BuiltDockerImages.txt";
const ApplicationPackagePath = "C:\\agent\\_work\\1\\a\\applicationpackage";
const ImageNameRegex = /^.*<ImageName>(.*)<\/ImageName>$/m; // Extracts image name from service manifest XML

let taskPath = path.join(__dirname, '..', 'servicefabricdocker.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerregistrytype', process.env[shared.ContainerTypeSetting] || shared.ContainerType_ContainerRegistry);
tr.setInput('applicationPackagePath', ApplicationPackagePath);
tr.setInput('imageNamesPath', ImageNamesPath);
tr.setInput('dockerRegistryEndpoint', 'dockerhubendpoint');
tr.setInput('azureSubscriptionEndpoint', 'AzureRMSpn');
tr.setInput('azureContainerRegistry', '{"loginServer":"ajgtestacr1.azurecr.io", "id" : "/subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/ajgtestacr1rg/providers/Microsoft.ContainerRegistry/registries/ajgtestacr1"}')
tr.setInput('includeSourceTags', process.env[shared.IncludeSourceTagsSetting] || false);
tr.setInput('additionalImageTags', process.env[shared.AdditionalTagsSetting] || '');

console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"test\", \"password\":\"regpassword\", \"email\":\"test@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";

// provide answers for task mock
let a = {
    "which": {
        "docker": "docker",
        "git": "git"
    },
     "checkPath": {
        "docker": true,
        "git": true,
        [ApplicationPackagePath]: true,
        [ImageNamesPath]: true
    },
    "exist": {
        "docker": true,
        "git": true,
        [ApplicationPackagePath]: true,
        [ImageNamesPath]: true
    },
    "exec": {} // These are generated below
};

let supportedEndpoints = [
    null /* Default Docker registry doesn't qualify image names with endpoint */,
    "ajgtestacr1.azurecr.io"
];

// Generate exec answers for all combinations of tags, images, and endpoints
process.env[shared.ExpectedTags].split(';').forEach(tag => {
    shared.BaseImageNames.forEach(image => {
        supportedEndpoints.forEach(endpoint => {
            console.log(`Setting exec answers for endpoint '${endpoint}', image '${image}', tag '${tag}'`);
            a.exec[`docker tag ${image} ${shared.qualifyImageName(endpoint, image)}:${tag}`] = {
                "code": 0
            };
        
            a.exec[`docker push ${shared.qualifyImageName(endpoint, image)}:${tag}`] = {
                "code": 0,
                "stdout": `${tag}: digest: sha256:${image}hash size: 10`
            };
        });
    });
});

tr.setAnswers(<any>a);

// Create mock for child_process module
let cp = require('child_process');
let cpClone = Object.assign({}, cp);
cpClone.execFileSync = function(command: string, args: string[], options) {
    if (command === 'git' && args[0] === 'tag') {
        return "sourcetag1\nsourcetag2";
    } else {
        return cp.execFileSync(command, args, options);
    }
};
tr.registerMock('child_process', cpClone);

// Create mock for fs module
let fs = require('fs');
let fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(filePath, options) {
    switch (filePath) {
        case ImageNamesPath:
            return shared.BaseImageNames.reduce((prev, current) => `${prev}\r\n${current}`);
        case path.join(ApplicationPackagePath, "Service1", "ServiceManifest.xml"):
            return fs.readFileSync(path.join(__dirname, "ServiceManifest1.xml"), options);
        case path.join(ApplicationPackagePath, "Service2", "ServiceManifest.xml"):
            return fs.readFileSync(path.join(__dirname, "ServiceManifest2.xml"), options);
        default:
            return fs.readFileSync(filePath, options);
    }
};
fsClone.readdirSync = function(path) {
    switch (path) {
        case ApplicationPackagePath:
            return ["Service1", "Service2"];
        default:
            return fs.readdirSync(path);
    }
};
fsClone.statSync = function(filePath) {
    switch (filePath) {
        case path.join(ApplicationPackagePath, "Service1"):
        case path.join(ApplicationPackagePath, "Service2"):
            return {
                isDirectory: function() { return true; }
            };
        default:
            return fs.statSync(filePath);
    }
};
fsClone.writeFile = function(filePath, content, options) {
    switch (filePath) {
        case path.join(ApplicationPackagePath, "Service1", "ServiceManifest.xml"):
            console.log("[test]image1Name: " + content.match(ImageNameRegex)[1]);
            return Q.resolve(null);
        case path.join(ApplicationPackagePath, "Service2", "ServiceManifest.xml"):
            console.log("[test]image2Name: " + content.match(ImageNameRegex)[1]);
            return Q.resolve(null);
        default:
            return fs.writeFile(filePath, options);
    }
};
tr.registerMock('fs', fsClone);

tr.run();