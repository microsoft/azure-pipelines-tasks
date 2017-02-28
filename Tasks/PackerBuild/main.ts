import tl = require("vsts-task-lib/task");
import path = require("path");

import * as ptm from "./packerTemplateManager";
import packerHost from "./packerHost";
import * as packerFix from "./operations/packerFix";
import * as packerValidate from "./operations/packerValidate";
import * as packerBuild from "./operations/packerBuild";
import * as tfp from "./templateFileProviders";
import * as tvp from "./templateVariablesProviders";

async function run(): Promise<any> {
    var host: packerHost = new packerHost();
    
    // TODO: move to method. register providers
    var builtInTemplateFileProvider = new tfp.BuiltInTemplateFileProvider();
    builtInTemplateFileProvider.register(host);
    var taskInputTemplateVariablesProvider = new tvp.TaskInputVariablesProvider();
    taskInputTemplateVariablesProvider.register(host);
    var spnVariablesProvider = new tvp.AzureSpnVariablesProvider();
    spnVariablesProvider.register(host);

    await packerFix.run(host);
    await packerValidate.run(host);
    var status = await packerBuild.run(host);

    var outputs: Map<string, string> = host.getExtractedOutputs();
    var imageUri = outputs.get("OSDiskUri");
    tl.debug("Setting image URI variable to: " + imageUri);
    tl.setVariable("imageUri", imageUri);

    var imageStorageAccount = outputs.get("StorageAccountLocation");
    tl.debug("Setting image storage location variable to: " + imageStorageAccount);
    tl.setVariable("imageStorageAccount", imageStorageAccount);
}

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("TaskNotFound", err));
    process.exit();
}

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) => 
    tl.setResult(tl.TaskResult.Failed, error)
);