"use strict";

import tl = require('azure-pipelines-task-lib/task');
import * as tr from "azure-pipelines-task-lib/toolrunner";
import path = require('path');
import * as fs from "fs";
import * as kubernetesCommand from "./kubernetescommand";
import ClusterConnection from "./clusterconnection";

export function run(connection: ClusterConnection, configMapName: string): Promise<any> {
    if(tl.getBoolInput("forceUpdateConfigMap") == false)
    {
        return executeKubetclGetConfigmapCommand(connection, configMapName).then(function success() {
            tl.debug(tl.loc('ConfigMapExists', configMapName));
        }, function failure() {
            return createConfigMap(connection, configMapName);
        });
    }    
    else if(tl.getBoolInput("forceUpdateConfigMap") == true) {
        return deleteConfigMap(connection, configMapName).fin(() =>{
            return createConfigMap(connection, configMapName);
        });
    }
}

function deleteConfigMap(connection: ClusterConnection, configMapName: string): any {
    tl.debug(tl.loc('DeleteConfigMap', configMapName));
    var command = connection.createCommand();
    command.arg(kubernetesCommand.getNameSpace());
    command.arg("delete")
    command.arg("configmap");
    command.arg(configMapName);
    var executionOption : tr.IExecOptions = <any> {
        silent: true,
        failOnStdErr: false,
        ignoreReturnCode: true
    };

    return connection.execCommand(command, executionOption);
}

function getConfigMapArguments(): string {
    if(tl.getBoolInput("useConfigMapFile") == true) {
        var configMapFileOrDirectoryPath = tl.getInput("configMapFile", false);
        var configMapFromFromFileArgument: string = "";
        if(configMapFileOrDirectoryPath && tl.exist(configMapFileOrDirectoryPath))
        {
            if (fs.statSync(configMapFileOrDirectoryPath).isFile())
            {
                var fileName = path.basename(configMapFileOrDirectoryPath);
                configMapFromFromFileArgument = "--from-file=" + fileName + "=" + configMapFileOrDirectoryPath;
            }
            else if (fs.statSync(configMapFileOrDirectoryPath).isDirectory())
            {
                configMapFromFromFileArgument = "--from-file=" + configMapFileOrDirectoryPath;
            }
        }

        return configMapFromFromFileArgument;
    } else { 
        return tl.getInput("configMapArguments", false);
    } 
}

function createConfigMap(connection: ClusterConnection, configMapName: string): any {
    tl.debug(tl.loc('CreatingConfigMap', configMapName)); 
    var command = connection.createCommand();
    command.arg(kubernetesCommand.getNameSpace());
    command.arg("create")
    command.arg("configmap");
    command.arg(configMapName);
    command.line(getConfigMapArguments());
    return connection.execCommand(command);
}

function executeKubetclGetConfigmapCommand(connection: ClusterConnection, configMapName: string): any {
    tl.debug(tl.loc('GetConfigMap', configMapName));
    var command = connection.createCommand();
    command.arg(kubernetesCommand.getNameSpace());
    command.arg("get")
    command.arg("configmap");
    command.arg(configMapName);
    var executionOption : tr.IExecOptions = <any> {
        silent: true
    };
    return connection.execCommand(command, executionOption);
}