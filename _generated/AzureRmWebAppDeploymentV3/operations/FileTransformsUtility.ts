import tl = require('azure-pipelines-task-lib/task');
import { TaskParameters } from './TaskParameters';
import { parse } from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

import { generateTemporaryFolderForDeployment, isMSDeployPackage, archiveFolderForDeployment } from 'azure-pipelines-tasks-webdeployment-common/utility';
import { fileTransformations } from 'azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility';
import { addWebConfigFile } from 'azure-pipelines-tasks-webdeployment-common/webconfigutil';

export class FileTransformsUtility {

    private static rootDirectoryPath: string = "D:\\home\\site\\wwwroot";

    public static async applyTransformations(webPackage: string, taskParams: TaskParameters): Promise<string> {
        var applyFileTransformFlag = taskParams.JSONFiles.length != 0 || taskParams.XmlTransformation || taskParams.XmlVariableSubstitution;
        if (applyFileTransformFlag || taskParams.GenerateWebConfig) {
            var isFolderBasedDeployment: boolean = tl.stats(webPackage).isDirectory();
            var folderPath = await generateTemporaryFolderForDeployment(isFolderBasedDeployment, webPackage, undefined);
            if (taskParams.GenerateWebConfig) {
                tl.debug('parsing web.config parameters');
                var webConfigParameters = parse(taskParams.WebConfigParameters);
                addWebConfigFile(folderPath, webConfigParameters, this.rootDirectoryPath);
            }

            if (applyFileTransformFlag) {
                var isMSBuildPackage = !isFolderBasedDeployment && (await isMSDeployPackage(webPackage));
                fileTransformations(isFolderBasedDeployment, taskParams.JSONFiles, taskParams.XmlTransformation, taskParams.XmlVariableSubstitution, folderPath, isMSBuildPackage);
            }

            var output = await archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
            webPackage = output.webDeployPkg;
        }
        else {
            tl.debug('File Tranformation not enabled');
        }

        return webPackage;
    }
}