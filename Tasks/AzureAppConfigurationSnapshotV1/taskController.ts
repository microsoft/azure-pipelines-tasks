import * as tl from "azure-pipelines-task-lib/task";
import { AppConfigurationClient, CreateSnapshotResponse } from '@azure/app-configuration';
import { RestError } from "@azure/core-rest-pipeline";
import { TaskParameters } from './taskParameters';
import { AppConfigurationError, getErrorMessage } from "./errors";
import { Utils } from './utils';

export class TaskController {
    private _taskParameters: TaskParameters;
    private _client: AppConfigurationClient;

    constructor(taskParameters: TaskParameters) {
        this._taskParameters = taskParameters;
        this._client = new AppConfigurationClient(
            taskParameters.configStoreUrl,
            taskParameters.credential,
            {
                userAgentOptions: {
                    userAgentPrefix: Utils.GenerateUserAgent()
                }
            }
        );
    } 

    public async createSnapshot(): Promise<void> {
        console.log(tl.loc("SnapshotTaskIsStartingUp"));
        console.log(tl.loc("AzureSubscriptionTitle"), this._taskParameters.endpoint.subscriptionName);
        console.log(tl.loc("AzureAppConfigurationEndpointTitle"), this._taskParameters.configStoreUrl);
        console.log(tl.loc("SnapshotNameTitle"), this._taskParameters.snapshotName);
        console.log(tl.loc("CompositionTypeTitle"), this._taskParameters.compositionType);
        console.log(tl.loc("FiltersTitle"), this._taskParameters.filters);

        try {
            const createdSnapshot: CreateSnapshotResponse = await this._client.beginCreateSnapshotAndWait({
                name: this._taskParameters.snapshotName,
                compositionType: this._taskParameters.compositionType,
                filters: this._taskParameters.filters,
                retentionPeriodInSeconds: this._taskParameters.retentionPeriod,
                tags: this._taskParameters.tags
            });

            console.log(tl.loc("SnapshotCreatedSuccessfully", createdSnapshot.name, new Date(createdSnapshot.createdOn), createdSnapshot.itemCount, createdSnapshot.sizeInBytes, createdSnapshot.status));
        }
        catch (error: any) {
            if (error instanceof RestError) {
                if (error.statusCode == 403) {
                    tl.debug(`${error.message}`);
                    throw new AppConfigurationError(getErrorMessage(error, tl.loc("AccessDenied")));
                }

                else if (error.statusCode == 409) {
                    throw new AppConfigurationError(getErrorMessage(error, tl.loc("SnapshotAlreadyExists", this._taskParameters.snapshotName)));
                }
                else if (error.statusCode == 400) {
                    const errorMessage: any = JSON.parse(error.message);

                    if (errorMessage["type"] == "https://azconfig.io/errors/invalid-argument" && errorMessage["name"] == "retention_period") {
                        throw new AppConfigurationError(getErrorMessage(error, tl.loc("MaxRetentionDaysforFreeStore")));
                    }
                }
            }
            throw error;
        }
    }
}