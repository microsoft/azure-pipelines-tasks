import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { Package } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { generateTemporaryFolderForDeployment } from 'azure-pipelines-tasks-webdeployment-common/utility';
import { archiveFolder } from 'azure-pipelines-tasks-webdeployment-common/ziputility';
import { advancedFileTransformations } from 'azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility';

async function main() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
    tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common/module.json'));
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
            let folderPath = await generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
            advancedFileTransformations(isFolderBasedDeployment, targetFiles, xmlTransformation, fileType, folderPath, xmlTransformationRules);
            await archiveFolder(folderPath, path.dirname(packagePath), path.basename(packagePath));
        }
        else {
            advancedFileTransformations(isFolderBasedDeployment, targetFiles, xmlTransformation, fileType, packagePath, xmlTransformationRules);
        }
    }
    else {
        tl.debug('File Transformation not enabled');
    }
}

main().catch((error) => {
	tl.setResult(tl.TaskResult.Failed, error);
});
