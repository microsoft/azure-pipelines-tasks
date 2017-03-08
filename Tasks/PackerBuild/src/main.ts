"use strict";

import tl = require("vsts-task-lib/task");
import path = require("path");

import packerHost from "./packerHost";
import * as packerFix from "./operations/packerFix";
import * as packerValidate from "./operations/packerValidate";
import * as packerBuild from "./operations/packerBuild";
import builtinTemplateFileProvider from "./builtinTemplateFileProvider";
import azureSpnTemplateVariablesProvider from "./azureSpnTemplateVariablesProvider";
import TaskInputTemplateVariablesProvider from "./taskInputTemplateVariablesProvider";

async function run(): Promise<any> {
    var host: packerHost = new packerHost();
    
    // register providers
    registerProviders(host);

    // run packer commands
    try {
        await packerFix.run(host);
        await packerValidate.run(host);
        await packerBuild.run(host);
        console.log(tl.loc("PackerBuildCompleted"));
    }
    finally {
        cleanup(host);
    }
}

function registerProviders(host: packerHost): void {
    
    // register built-in templates provider. This provider provides built-in packer templates used by task
    var builtInTemplateFileProvider = new builtinTemplateFileProvider();
    builtInTemplateFileProvider.register(host);

    // register variables provider which will provide task inputs as variables for packer template
    var taskInputTemplateVariablesProvider = new TaskInputTemplateVariablesProvider();
    taskInputTemplateVariablesProvider.register(host);

    //register SPN variables provider which will fetch SPN data as variables for packer template
    var spnVariablesProvider = new azureSpnTemplateVariablesProvider();
    spnVariablesProvider.register(host);
}

function cleanup(host: packerHost): void {
    var fileProvider = host.getTemplateFileProvider();
    fileProvider.cleanup();
}

tl.setResourcePath(path.join(__dirname, "..//task.json"));

run().then((result) =>
    tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) => 
    tl.setResult(tl.TaskResult.Failed, error)
);