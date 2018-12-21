import tl = require('vsts-task-lib/task');
import { Package } from 'webdeployment-common/packageUtility';
var deployUtility = require('webdeployment-common/utility.js');
var fileTransformationsUtility = require('webdeployment-common/fileTransformationsUtility.js');

async function main() {
    let webPackage = new Package(tl.getPathInput('folderPath', true));
    let packagePath = webPackage.getPath();
    let JSONFiles = tl.getDelimitedInput('JSONFiles', '\n', false);
    let XmlVariableSubstitution = tl.getBoolInput("enableXmlVariableSubstitution", false);
    let applyFileTransformFlag = JSONFiles.length != 0 || XmlVariableSubstitution;
    if (applyFileTransformFlag) {
        let isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        let folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
        let isMSBuildPackage = !isFolderBasedDeployment && (await deployUtility.isMSDeployPackage(packagePath));
        fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, JSONFiles, false, XmlVariableSubstitution, folderPath, isMSBuildPackage);
    }
    else {
        tl.debug('File Tranformation not enabled');
    }
}

main();