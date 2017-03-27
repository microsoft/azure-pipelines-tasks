"use strict";

import * as del from "del";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import DockerComposeConnection from "./dockerComposeConnection";
import { createImageDigestComposeFile } from "./dockerComposeDigests";
import { run as runDockerComposeConfig } from "./dockerComposeConfig";

export function run(connection: DockerComposeConnection): any {
    var agentDirectory = tl.getVariable("Agent.HomeDirectory"),
        imageDigestComposeFile = path.join(agentDirectory, ".docker-compose.images" + Date.now() + ".yml");
    return createImageDigestComposeFile(connection, imageDigestComposeFile)
        .then(() => runDockerComposeConfig(connection, imageDigestComposeFile))
        .fin(() => {
            if (tl.exist(imageDigestComposeFile)) {
                del.sync(imageDigestComposeFile, { force: true });
            }
        });
}
