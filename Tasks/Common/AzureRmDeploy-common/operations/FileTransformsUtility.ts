import tl = require('azure-pipelines-task-lib/task');
import { parse } from './ParameterParserUtility';
import { PackageType } from '../webdeployment-common/packageUtility';
var deployUtility = require('../webdeployment-common/utility.js');
var generateWebConfigUtil = require('../webdeployment-common/webconfigutil.js');

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
            tl.debug('File Tranformation not enabled');
        }

        return webPackage;
    }
}