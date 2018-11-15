import tl = require('vsts-task-lib/task');
import { Package } from 'webdeployment-common/packageUtility';
var deployUtility = require('webdeployment-common/utility.js');
var fileTransformationsUtility = require('webdeployment-common/fileTransformationsUtility.js');

async function main() {
    var webPackage = new Package(tl.getPathInput('folderPath', true));
    var packagePath = webPackage.getPath();
    var JSONFiles = tl.getDelimitedInput('JSONFiles', '\n', false);
    var XmlTransformation = tl.getBoolInput("enableXmlTransform", false);
    var XmlVariableSubstitution = tl.getBoolInput("enableXmlVariableSubstitution", false);
    var applyFileTransformFlag = JSONFiles.length != 0 || XmlTransformation || XmlVariableSubstitution;
    if (applyFileTransformFlag) {
        var isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());

        var isMSBuildPackage = !isFolderBasedDeployment && (await deployUtility.isMSDeployPackage(packagePath));
        fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, JSONFiles, XmlTransformation, XmlVariableSubstitution, folderPath, isMSBuildPackage);
    }
    else {
        tl.debug('File Tranformation not enabled');
    }

    tl.setVariable('PackageFolderPath', folderPath);
}

main();