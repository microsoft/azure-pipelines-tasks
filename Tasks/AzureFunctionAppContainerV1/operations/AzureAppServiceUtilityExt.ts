import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from 'azure-pipelines-tasks-azurermdeploycommon/azure-arm-rest/azure-arm-app-service';

export class AzureAppServiceUtilityExt {
    private _appService: AzureAppService;
    constructor(appService: AzureAppService) {
        this._appService = appService;
    }

    public async isFunctionAppOnCentauri(): Promise<boolean>{
        try{
            let details: any =  await this._appService.get();
            if (details.properties["managedEnvironmentId"]){
                tl.debug("Function Container app is on Centauri.");
                return true;
            }
            else{                
                return false;    
            }
        }
        catch(error){
            tl.debug(`Skipping Centauri check: ${error}`);
            return false;
        }        
    }

    public async updateAndMonitorAppSettingsCentauri(addProperties?: any, perSlot:boolean=true, deleteProperties?: any, formatJSON?: boolean): Promise<boolean> {
        if(formatJSON) {
            var appSettingsProperties = {};
            for(var property in addProperties) {
                appSettingsProperties[addProperties[property].name] = addProperties[property].value;
            }
        
            if(!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(appSettingsProperties)));
            }

            if(!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }
            
            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(appSettingsProperties, deleteProperties, true);
        }
        else {
            for(var property in addProperties) {
                if(!!addProperties[property] && addProperties[property].value !== undefined) {
                    addProperties[property] = addProperties[property].value;
                }
            }
            
            if(!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(addProperties)));
            }

            if(!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }

            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(addProperties, deleteProperties);
        }     

        if(!!isNewValueUpdated) {
            console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
        }
        else {
            console.log(tl.loc('AppServiceApplicationSettingsAlreadyPresent'));
        }

        if (perSlot){
            await this._appService.patchApplicationSettingsSlot(addProperties);
        }        
        return isNewValueUpdated;
    }
}