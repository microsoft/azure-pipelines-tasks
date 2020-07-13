"use strict";

import Q = require('q');
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "docker-common-v2/containerconnection";

export function run(connection: ContainerConnection): any {
    var defer = Q.defer<any>();
    connection.setDockerConfigEnvVariable();   
    defer.resolve(null);
    return defer.promise;
}