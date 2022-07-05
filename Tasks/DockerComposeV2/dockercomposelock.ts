"use strict";

import * as del from "del";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import { createImageDigestComposeFile } from "./dockercomposedigests";
import { run as runDockerComposeConfig } from "./dockercomposeconfig";
import * as utils from "./utils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var agentDirectory = tl.getVariable("Agent.HomeDirectory"),
        imageDigestComposeFile = path.join(agentDirectory, ".docker-compose.images" + Date.now() + ".yml");
    
    return createImageDigestComposeFile(connection, imageDigestComposeFile, outputUpdate)
        .then(() => runDockerComposeConfig(connection, outputUpdate, imageDigestComposeFile))
        .fin(() => {
            if (tl.exist(imageDigestComposeFile)) {
                del.sync(imageDigestComposeFile, { force: true });
            }
        });
}
