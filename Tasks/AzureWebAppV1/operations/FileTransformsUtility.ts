import tl = require('azure-pipelines-task-lib/task');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility');
var generateWebConfigUtil = require('azure-pipelines-tasks-webdeployment-common/webconfigutil');
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { parse } from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

export class FileTransformsUtility {

    private static rootDirectoryPath: string = "D:\\home\\site\\wwwroot";
    public static async applyTransformations(webPackage: string, parameters: string, packageType: PackageType): Promise<string> {
        tl.debug("WebConfigParameters is "+ parameters);
        if (parameters) {
            var isFolderBasedDeployment: boolean = tl.stats(webPackage).isDirectory();
            var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, webPackage, packageType);
            if (parameters) {
                tl.debug('parsing web.config parameters');
                var webConfigParameters = parse(parameters);
                generateWebConfigUtil.addWebConfigFile(folderPath, webConfigParameters, this.rootDirectoryPath);
            }

            var output = await deployUtility.archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
            webPackage = output.webDeployPkg;
        }
        else {
            tl.debug('File Transformation not enabled');
        }

        return webPackage;
    }
}