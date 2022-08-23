import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { Package } from 'azure-pipelines-tasks-webdeployment-common-v4/packageUtility';
var deployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common-v4/ziputility.js');
var fileTransformationsUtility = require('azure-pipelines-tasks-webdeployment-common-v4/fileTransformationsUtility.js');

async function main() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
    tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common-v4/module.json'));
    let webPackage = new Package(tl.getPathInput('folderPath', true));
    let packagePath = webPackage.getPath();
    let xmlTransformation = true;
    let xmlTransformationRules = tl.getDelimitedInput('xmlTransformationRules', '\n', false);
    let xmlTargetFiles = tl.getDelimitedInput('xmlTargetFiles', '\n', false);
    let jsonTargetFiles = tl.getDelimitedInput('jsonTargetFiles', '\n', false);
    if(xmlTransformationRules.length == 0) {
        xmlTransformation = false;
    }

    if ( xmlTransformation || xmlTargetFiles.length != 0 || jsonTargetFiles.length != 0) {
        let isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        if(!isFolderBasedDeployment) {
            var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
            fileTransformationsUtility.enhancedFileTransformations(isFolderBasedDeployment, xmlTransformation, folderPath, xmlTransformationRules, xmlTargetFiles, jsonTargetFiles);
            await zipUtility.archiveFolder(folderPath, path.dirname(packagePath), path.basename(packagePath));
        }
        else {
            fileTransformationsUtility.enhancedFileTransformations(isFolderBasedDeployment, xmlTransformation, packagePath, xmlTransformationRules, xmlTargetFiles, jsonTargetFiles);
        }
    }
    else {
        throw Error(tl.loc('FileTranformationNotEnabled'));
    }
}

main().catch((error) => {
	tl.setResult(tl.TaskResult.Failed, error);
});