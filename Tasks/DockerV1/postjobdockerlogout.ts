"use strict";

import * as del from "del";
import * as fs from "fs";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    var connection = new ContainerConnection();
    connection.unsetDockerConfigEnvVariable();  
}

run();