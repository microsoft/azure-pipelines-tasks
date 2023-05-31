"use strict";

import Q = require('q');
import trm = require('azure-pipelines-task-lib/toolrunner');
import ClusterConnection from "./clusterconnection";

export function run(connection: ClusterConnection, kubecommand: string, outputUpdate: (data: string) => any): any {
    var defer = Q.defer<any>();
    connection.setKubeConfigEnvVariable();
    defer.resolve(undefined);
    return defer.promise;
}