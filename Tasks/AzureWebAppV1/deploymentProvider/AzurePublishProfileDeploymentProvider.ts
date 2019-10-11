import tl = require('azure-pipelines-task-lib/task');
import { KuduServiceUtility } from 'azurermdeploycommon/operations/KuduServiceUtility';
import { Kudu } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service-kudu';
import { PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import { TaskParameters } from '../taskparameters';
import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
var zipUtility = require('azurermdeploycommon/webdeployment-common/ziputility.js');
var deployUtility = require('azurermdeploycommon/webdeployment-common/utility.js');

var parseString = require('xml2js').parseString;

interface scmCredentials {
    uri: string;
    username: string;
    password: string;
}

export class AzurePublishProfileDeploymentProvider implements IWebAppDeploymentProvider {
    private taskParams: TaskParameters;
    private kuduService: Kudu;
    private kuduServiceUtility: KuduServiceUtility;
    private activeDeploymentID: string;
    private applicationURL: string;
    private zipDeploymentID: string;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PreDeploymentStep() {
        let publishProfileEndpoint = this.taskParams.azureEndpoint;
        let scmCreds: scmCredentials = await this.getSCMCredentialsFromPublishProfile(publishProfileEndpoint.PublishProfile);
        this.kuduService = new Kudu(scmCreds.uri, scmCreds.username, scmCreds.password);
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let packagePath = this.taskParams.Package.getPath();
        await this.kuduServiceUtility.warmpUp();
        
        switch(packageType){
            case PackageType.folder:
                let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                let archivedWebPackage = await zipUtility.archiveFolder(packagePath, "", tempPackagePath) as string;
                tl.debug("Compressed folder into zip " +  archivedWebPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(archivedWebPackage);
            break;

            case PackageType.zip:
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(packagePath);
            break;

            case PackageType.jar:
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ packagePath);
                let folderPath = await deployUtility.generateTemporaryFolderForDeployment(false, packagePath, PackageType.jar);
                let output = await deployUtility.archiveFolderForDeployment(false, folderPath);
                let webPackage = output.webDeployPkg;
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ webPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage);
            break;

            case PackageType.war:
                tl.debug("Initiated deployment via kudu service for webapp war package : "+ packagePath);
                let warName = deployUtility.getFileNameFromPath(packagePath, ".war");
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(packagePath, { }, warName);
            break;

            default:
                throw new Error('Invalid App Service package or folder path provided: ' + packagePath);
        }
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment'});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);

            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
        
        console.log('App Service Application URL: ' + this.applicationURL);
        tl.setVariable('AppServiceApplicationUrl', this.applicationURL);
    }

    private async getSCMCredentialsFromPublishProfile(pubxmlFile: string): Promise<scmCredentials> {
        let res;
        await parseString(pubxmlFile, (error, result) => {
            if(!!error) {
                throw new Error("Failed XML parsing " + error);
            }
            res = result.publishData.publishProfile[0].$;
        });
        let credentials: scmCredentials = {
            uri: res.publishUrl.split(":")[0],
            username: res.userName,
            password: res.userPWD
        };
        console.log(`${credentials.username}`);
        console.log(`${credentials.uri}`);
        if(credentials.uri.indexOf("scm") < 0) {
            throw new Error("Publish profile does not contain kudu URL");
        }
        credentials.uri = `https://${credentials.username}:${credentials.password}@${credentials.uri}`;
        this.applicationURL = res.destinationAppUrl;
        return credentials;
    }
}