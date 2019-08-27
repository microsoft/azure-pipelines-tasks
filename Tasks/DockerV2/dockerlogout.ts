"use strict";

import Q = require('q');
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "docker-common-v2/containerconnection";

export function run(connection: ContainerConnection): any {
    // logging out is being handled in connection.close() method, called after the command execution.
    var defer = Q.defer<any>();
    defer.resolve(null);
    return <Q.Promise<any>>defer.promise;
}
