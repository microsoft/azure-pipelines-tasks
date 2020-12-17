import { PackageType } from './packageUtility';
/**
 * Validates the input package and finds out input type
 *
 * @param webDeployPkg Web Deploy Package input
 *
 * @return true/false based on input package type.
 */
export declare function isInputPkgIsFolder(webDeployPkg: string): boolean;
/**
 * Checks whether the given path is file or not.
 * @param path input file path
 *
 * @return true/false based on input is file or not.

 */
export declare function fileExists(path: any): boolean;
/**
 * Validates whether input for path and returns right path.
 *
 * @param path input
 *
 * @returns null when input is empty, otherwise returns same path.
 */
export declare function copySetParamFileIfItExists(setParametersFile: string): string;
/**
 * Checks if WebDeploy should be used to deploy webapp package or folder
 *
 * @param useWebDeploy if user explicitly checked useWebDeploy
 */
export declare function canUseWebDeploy(useWebDeploy: boolean): true | RegExpMatchArray;
export declare function findfiles(filepath: any): string[];
export declare function generateTemporaryFolderOrZipPath(folderPath: string, isFolder: boolean): any;
/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
export declare function isMSDeployPackage(webAppPackage: string): Promise<boolean>;
export declare function copyDirectory(sourceDirectory: string, destDirectory: string): void;
export declare function generateTemporaryFolderForDeployment(isFolderBasedDeployment: boolean, webDeployPkg: string, packageType: PackageType): Promise<any>;
export declare function archiveFolderForDeployment(isFolderBasedDeployment: boolean, folderPath: string): Promise<{
    webDeployPkg: any;
    tempPackagePath: any;
}>;
export declare function getFileNameFromPath(filePath: string, extension?: string): string;
