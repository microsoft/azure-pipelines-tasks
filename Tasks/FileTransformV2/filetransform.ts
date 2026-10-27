import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { Package } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { generateTemporaryFolderForDeployment } from 'azure-pipelines-tasks-webdeployment-common/utility';
import { archiveFolder } from 'azure-pipelines-tasks-webdeployment-common/ziputility';
import { enhancedFileTransformations } from 'azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility';

async function main() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
    tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common/module.json'));
    let webPackage = new Package(tl.getPathInput('folderPath', true));
    let packagePath = webPackage.getPath();
    const osType = tl.getPlatform();
    let xmlTransformation = osType === tl.Platform.Windows ? tl.getBoolInput('enableXmlTransform', false) : false;
    let xmlTransformationRules = tl.getDelimitedInput('xmlTransformationRules', '\n', false);
    let xmlTargetFiles = tl.getDelimitedInput('xmlTargetFiles', '\n', false);
    let jsonTargetFiles = tl.getDelimitedInput('jsonTargetFiles', '\n', false);

    if ( xmlTransformation || xmlTargetFiles.length != 0 || jsonTargetFiles.length != 0) {
        const diagnosticsMode = tl.getPipelineFeature('EnableVsoCommandBlockingRMTasks') ? 'blockAndTelemetry' : 'telemetryOnly';
        let isFolderBasedDeployment: boolean = tl.stats(packagePath).isDirectory();
        if(!isFolderBasedDeployment) {
            const folderPath = await generateTemporaryFolderForDeployment(isFolderBasedDeployment, packagePath, webPackage.getPackageType());
            enhancedFileTransformations(isFolderBasedDeployment, xmlTransformation, folderPath, xmlTransformationRules, xmlTargetFiles, jsonTargetFiles, diagnosticsMode);
            await archiveFolder(folderPath, path.dirname(packagePath), path.basename(packagePath));
        }
        else {
            enhancedFileTransformations(isFolderBasedDeployment, xmlTransformation, packagePath, xmlTransformationRules, xmlTargetFiles, jsonTargetFiles, diagnosticsMode);
        }
    }
    else {
        throw Error(tl.loc('FileTranformationNotEnabled'));
    }
}

main().catch((error) => {
	tl.setResult(tl.TaskResult.Failed, error);
});