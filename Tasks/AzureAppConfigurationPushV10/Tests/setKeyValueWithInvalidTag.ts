import * as path from "path";
import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";

const taskPath = path.join(__dirname, "..", "index.js");
const taskRunner:TaskMockRunner = new TaskMockRunner(taskPath);

const configurationFile: string = path.join(__dirname, 'sourceFiles/validConfigFile.json');

taskRunner.setInput("AppConfigurationEndpoint", "https://Test.azconfig.io");
taskRunner.setInput("ConfigurationFile", `${configurationFile}`);
taskRunner.setInput("UseFilePathExtension", "true");
taskRunner.setInput("Strict", "false");
taskRunner.setInput("Separator", ":");
taskRunner.setInput("Tags", "tags");
taskRunner.setInput("ConnectedServiceName","AzureRMSpn");

taskRunner.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
taskRunner.registerMock('@azure/app-configuration', require('./mock_node_modules/app-configuration/appConfigurationClient'));

taskRunner.run();