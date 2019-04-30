"use strict";

import Q = require('q');
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    var defer = Q.defer<any>();
    connection.setDockerConfigEnvVariable();   
    defer.resolve(null);
    return defer.promise;
}