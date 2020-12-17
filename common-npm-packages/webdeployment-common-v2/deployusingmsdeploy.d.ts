import { WebDeployArguments, WebDeployResult } from './msdeployutility';
/**
 * Executes Web Deploy command
 *
 * @param   webDeployPkg                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 *
 */
export declare function DeployUsingMSDeploy(webDeployPkg: any, webAppName: any, publishingProfile: any, removeAdditionalFilesFlag: any, excludeFilesFromAppDataFlag: any, takeAppOfflineFlag: any, virtualApplication: any, setParametersFile: any, additionalArguments: any, isFolderBasedDeployment: any, useWebDeploy: any): Promise<void>;
export declare function executeWebDeploy(WebDeployArguments: WebDeployArguments, publishingProfile: any): Promise<WebDeployResult>;
