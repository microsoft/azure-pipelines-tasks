import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

export class AzureAppServiceUtils {

    public static async monitorApplicationState(appService: AzureAppService, state: string): Promise<void> {
        state = state.toLowerCase();
        if(["running", "stopped"].indexOf(state) == -1) {
            throw new Error(tl.loc('InvalidMonitorAppState', state));
        }

        while(true) {
            var appDetails = await appService.get(true);
            if(appDetails && appDetails.properties && appDetails.properties["state"]) {
                tl.debug(`App Service state: ${appDetails.properties["state"]}`)
                if(appDetails.properties["state"].toLowerCase() == state) {
                    tl.debug(`App Service state '${appDetails.properties["state"]}' matched with expected state '${state}'.`);
                    console.log(tl.loc('AppServiceState', appDetails.properties["state"]));
                    break;
                }
                await webClient.sleepFor(5);
            }
            else {
                tl.debug('Unable to monitor app service details as the state is unknown.');
                break;
            }
        }
    }
}