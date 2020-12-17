import { Package } from './packageUtility';
/**
 * Constructs argument for MSDeploy command
 *
 * @param   webAppPackage                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * @param   isParamFilePresentInPacakge     Flag to check Paramter.xml file
 * @param   isFolderBasedDeployment         Flag to check if given web package path is a folder
 *
 * @returns string
 */
export declare function getMSDeployCmdArgs(webAppPackage: string, webAppName: string, publishingProfile: any, removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean, virtualApplication: string, setParametersFile: string, additionalArguments: string, isParamFilePresentInPacakge: boolean, isFolderBasedDeployment: boolean, useWebDeploy: boolean): string;
export declare function getWebDeployArgumentsString(webDeployArguments: WebDeployArguments, publishingProfile: any): Promise<string>;
/**
 * Gets the full path of MSDeploy.exe
 *
 * @returns    string
 */
export declare function getMSDeployFullPath(): Promise<any>;
/**
 * 1. Checks if msdeploy during execution redirected any error to
 * error stream ( saved in error.txt) , display error to console
 * 2. Checks if there is file in use error , suggest to try app offline.
 */
export declare function redirectMSDeployErrorToConsole(): void;
export declare function getWebDeployErrorCode(errorMessage: any): string;
export interface WebDeployArguments {
    package: Package;
    appName: string;
    publishUrl?: string;
    userName?: string;
    password?: string;
    removeAdditionalFilesFlag?: boolean;
    excludeFilesFromAppDataFlag?: boolean;
    takeAppOfflineFlag?: boolean;
    virtualApplication?: string;
    setParametersFile?: string;
    additionalArguments?: string;
    useWebDeploy?: boolean;
}
export interface WebDeployResult {
    isSuccess: boolean;
    errorCode?: string;
    error?: string;
}
