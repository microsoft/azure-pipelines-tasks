"use strict";

import Q = require('q');
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    var defer = Q.defer<any>();
    connection.setDockerConfigEnvVariable();   
    defer.resolve(null);
    return defer.promise;
}