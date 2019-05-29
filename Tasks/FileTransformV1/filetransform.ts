import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { Package } from 'webdeployment-common-v2/packageUtility';
var deployUtility = require('webdeployment-common-v2/utility.js');
var zipUtility = require('webdeployment-common-v2/ziputility.js');
var fileTransformationsUtility = require('webdeployment-common-v2/fileTransformationsUtility.js');

async function main() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
    tl.setResourcePath(path.join( __dirname, 'node_modules/webdeployment-common-v2/module.json'));
    let webPackage = new Package(tl.getPathInput('folderPath', true));
    let packagePath = webPackage.getPath();
    let fileType = tl.getInput("fileType", false);
    let targetFiles = tl.getDelimitedInput('targetFiles', '\n', false);
    let xmlTransformation = tl.getBoolInput('enableXmlTransform', false);
    let xmlTransformationRules = tl.getDelimitedInput('xmlTransformationRules', '\n', false);
    let applyFileTransformFlag = fileType || xmlTransformation;
    if (applyFileTransformFlag) {
        let isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        if(!isFolderBasedDeployment) {
            var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
            fileTransformationsUtility.advancedFileTransformations(isFolderBasedDeployment, targetFiles, xmlTransformation, fileType, folderPath, xmlTransformationRules);
            await zipUtility.archiveFolder(folderPath, path.dirname(packagePath), path.basename(packagePath));
        }
        else {
            fileTransformationsUtility.advancedFileTransformations(isFolderBasedDeployment, targetFiles, xmlTransformation, fileType, packagePath, xmlTransformationRules);
        }
    }
    else {
        tl.debug('File Tranformation not enabled');
    }
}

main().catch((error) => {
	tl.setResult(tl.TaskResult.Failed, error);
});