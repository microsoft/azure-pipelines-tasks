import * as tl from "azure-pipelines-task-lib/task";
import { AppConfigurationClient, CreateSnapshotResponse } from '@azure/app-configuration';
import { RestError } from "@azure/core-rest-pipeline";
import { TaskParameters } from './taskParameters';
import { AppConfigurationError, getErrorMessage } from "./errors";
import { Utils } from './utils';
import { format } from "util";

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
        tl.writeExternalOutput(`${tl.loc("AzureSubscriptionTitle")} ${this._taskParameters.endpoint.subscriptionName}\n`, { source: "remote" });
        tl.writeExternalOutput(`${tl.loc("AzureAppConfigurationEndpointTitle")} ${this._taskParameters.configStoreUrl}\n`, { source: "repository" });
        tl.writeExternalOutput(`${tl.loc("SnapshotNameTitle")} ${this._taskParameters.snapshotName}\n`, { source: "repository" });
        console.log(tl.loc("CompositionTypeTitle"), this._taskParameters.compositionType);
        tl.writeExternalOutput(format(tl.loc("FiltersTitle"), this._taskParameters.filters) + "\n", { source: "repository" });

        try {
            const createdSnapshot: CreateSnapshotResponse = await this._client.beginCreateSnapshotAndWait({
                name: this._taskParameters.snapshotName,
                compositionType: this._taskParameters.compositionType,
                filters: this._taskParameters.filters,
                retentionPeriodInSeconds: this._taskParameters.retentionPeriod,
                tags: this._taskParameters.tags
            });

            tl.writeExternalOutput(tl.loc("SnapshotCreatedSuccessfully", createdSnapshot.name, new Date(createdSnapshot.createdOn), createdSnapshot.itemCount, createdSnapshot.sizeInBytes, createdSnapshot.status) + "\n", { source: "remote" });
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