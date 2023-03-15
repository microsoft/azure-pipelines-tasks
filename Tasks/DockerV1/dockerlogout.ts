"use strict";

import Q = require('q');
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    connection.unsetDockerConfigEnvVariable();   
    var defer = Q.defer<any>();
    defer.resolve(undefined);
    return <Q.Promise<any>>defer.promise;
}
