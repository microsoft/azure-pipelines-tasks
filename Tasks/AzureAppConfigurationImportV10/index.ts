import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import { TaskParameters } from "./taskParameters";
import { AppConfigurationError } from './errors';
import { TaskController } from './taskController';
import { AuthenticationError } from "@azure/identity";
import { RestError } from '@azure/core-rest-pipeline';
import { Utils } from './utils';

async function run(): Promise<void> {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        const taskParam: TaskParameters = await TaskParameters.initialize();

        const taskController: TaskController = new TaskController(taskParam);

        await taskController.sync();

        tl.setResult(tl.TaskResult.Succeeded, "", true);
    }
    catch (e) {
        tl.debug(e);

        if (Utils.IsInstanceOf(e, "ArgumentError") ||Utils.IsInstanceOf(e, "ParseError") || e instanceof AppConfigurationError) {

            tl.error(e.message);
        }
        else if (e instanceof AuthenticationError) {

            tl.error(tl.loc("AuthenticationError", JSON.stringify(e.errorResponse), e.statusCode, e.message));
        }
        else if (e instanceof RestError && e.statusCode == 401) {

            tl.error(tl.loc("AuthenticationErrorRestError", e.statusCode, e.request.url, e.message, e.response.headers.get("www-authenticate"), e.request.headers.get("x-ms-client-request-id")));
            tl.debug(e.response?.bodyAsText);
        }
        else if (e instanceof RestError) {

            tl.error(tl.loc("RestError",e.name !== undefined? e.name: "", e.code !== undefined ? e.code: "", e.statusCode, e.request.url, e.message, e.request.headers.get("x-ms-client-request-id")));
            tl.debug(e.response?.bodyAsText);
        }
        else {
            tl.error(tl.loc("UnexpectedError", e.message));
        }

        tl.setResult(tl.TaskResult.Failed, "", true);
    }
}

run();
