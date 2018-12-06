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
    let JSONFiles = tl.getDelimitedInput('JSONFiles', '\n', false);
    let XmlVariableSubstitution = tl.getBoolInput("enableXmlVariableSubstitution", false);
    let XmlTransformation = tl.getBoolInput('enableXmlTransform', false);
    let transformationRules = tl.getDelimitedInput('transformationRules', '\n', false);
    let applyFileTransformFlag = JSONFiles.length != 0 || XmlVariableSubstitution || XmlTransformation;
    if (applyFileTransformFlag) {
        let isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        if(!isFolderBasedDeployment) {
            var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
            fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, JSONFiles, XmlTransformation, XmlVariableSubstitution, folderPath, false, transformationRules);
            await zipUtility.archiveFolder(folderPath, path.dirname(packagePath), path.basename(packagePath));
        }
        else {
            fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, JSONFiles, XmlTransformation, XmlVariableSubstitution, packagePath, false, transformationRules);
        }
    }
    else {
        tl.debug('File Tranformation not enabled');
    }
}

main();