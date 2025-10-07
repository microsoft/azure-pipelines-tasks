import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import { TaskController } from "./taskController";
import { TaskParameters } from "./taskParameter";
import { RestError } from '@azure/core-rest-pipeline';
import { AuthenticationError } from '@azure/identity';
import { AppConfigurationError, ArgumentError } from "./errors";

async function run(): Promise<void> {
    try {

        const taskManifestPath: string = path.join(__dirname, "task.json");
        tl.setResourcePath(taskManifestPath);

        const taskParam: TaskParameters = await TaskParameters.initializeTaskParameters();
        const taskController: TaskController = new TaskController(taskParam);

        const result: tl.TaskResult = await taskController.downloadKeyValue();

        tl.setResult(result, "", true);
    }
    catch (e) {

        if (e instanceof ArgumentError || e instanceof AppConfigurationError) {

            tl.error(e.message);
        }
        else if (e instanceof AuthenticationError) {

            tl.error(tl.loc("AuthenticationError", JSON.stringify(e.errorResponse), e.statusCode, e.message));
        }
        else if (e instanceof RestError && e.statusCode == 401) {

            tl.error(tl.loc("AuthenticationRestError", e.statusCode, e.request.url, e.message, e.response.headers.get("www-authenticate"), e.request.headers.get("x-ms-client-request-id")));
            tl.debug(e.response?.bodyAsText);
        }
        else if (e instanceof RestError) {

            tl.error(tl.loc("HttpError", e.name !== undefined ? e.name : "", e.code !== undefined ? e.code : "", e.statusCode, e.request.url, e.message, e.request.headers.get("x-ms-client-request-id")));
            tl.debug(e.response?.bodyAsText);
        }
        else {
            tl.error(tl.loc("AnUnexpectedError", e.message)); 
        }

        tl.setResult(tl.TaskResult.Failed, "", true);
    }
}

run();