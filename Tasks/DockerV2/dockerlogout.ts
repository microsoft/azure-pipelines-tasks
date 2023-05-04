"use strict";

import Q = require('q');
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    // logging out is being handled in connection.close() method, called after the command execution.
    var defer = Q.defer<any>();
    defer.resolve(null);
    return <Q.Promise<any>>defer.promise;
}
