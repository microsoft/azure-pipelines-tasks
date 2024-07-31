import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import { AuthenticationError } from "@azure/identity";
import { RestError } from "@azure/core-rest-pipeline";
import { TaskParameters } from "./taskParameters";
import { TaskController } from "./taskController";
import { AppConfigurationError, ArgumentError, ParseError } from "./errors";

async function run(): Promise<void> {
    try {
        const taskManifestPath: string = path.join(__dirname, "task.json");
        tl.setResourcePath(taskManifestPath);

        const taskParameters: TaskParameters = await TaskParameters.initialize();
        const taskController: TaskController = new TaskController(taskParameters);

        await taskController.createSnapshot();

        tl.setResult(tl.TaskResult.Succeeded, "", true);
    }
    catch (error: any) {
        if (error instanceof AppConfigurationError || error instanceof ArgumentError || error instanceof ParseError) {
            tl.error(error.message);
        }
        else if (error instanceof AuthenticationError) {
            tl.error(tl.loc("AuthenticationError", JSON.stringify(error.errorResponse), error.statusCode, error.message));
        }
        else if (error instanceof RestError && error.statusCode == 401) {
            tl.error(tl.loc("UnauthenticatedRestError", error.statusCode, error.request.url, error.message, error.response.headers.get("www-authenticate"), error.request.headers.get("x-ms-client-request-id")));
        }
        else if (error instanceof RestError) {
            tl.error(tl.loc("HttpError", error.name !== undefined ? error.name: "", error.code !== undefined ? error.code: "", error.statusCode, error.request.url, error.message, error.request.headers.get("x-ms-client-request-id")));
        }
        else {
            tl.error(tl.loc("UnexpectedError", error.message));
            tl.debug(JSON.stringify(error));
        }
        tl.setResult(tl.TaskResult.Failed, "", true);
    }
}

run();