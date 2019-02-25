"use strict";

import Q = require('q');
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    connection.unsetDockerConfigEnvVariable();   
    var defer = Q.defer<any>();
    defer.resolve(null);
    return <Q.Promise<any>>defer.promise;
}
