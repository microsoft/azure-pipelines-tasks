import tl = require('vsts-task-lib/task');
import path = require('path');
import { Package } from 'webdeployment-common/packageUtility';
var deployUtility = require('webdeployment-common/utility.js');
var zipUtility = require('webdeployment-common/ziputility.js');
var fileTransformationsUtility = require('webdeployment-common/fileTransformationsUtility.js');

async function main() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
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