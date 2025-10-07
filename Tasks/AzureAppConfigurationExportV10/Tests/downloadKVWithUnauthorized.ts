import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
import * as path from "path";

let taskPath = path.join(__dirname, "..", "index.js");
let taskRunner:TaskMockRunner = new TaskMockRunner(taskPath);

taskRunner.setInput("AppConfigurationEndpoint", "https://Test.azconfig.io");
taskRunner.setInput("selectionMode", "Default");
taskRunner.setInput("keyFilter", "*");
taskRunner.setInput("ConnectedServiceName","AzureRMSpn");

taskRunner.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
taskRunner.registerMock('@azure/app-configuration', require('./mock_node_modules/app-configuration/unauthorizedAppConfigurationClient'));
taskRunner.registerMock('./azure-arm-common', require('./mock_node_modules/azure-pipelines-tasks-azure-arm-rest/azure-arm-common'));

taskRunner.run();