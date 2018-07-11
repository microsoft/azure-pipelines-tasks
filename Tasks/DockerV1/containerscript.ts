"use strict";
import fs = require('fs');
import path = require('path');
import os = require('os');
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
   return connection.execScript();
}