"use strict";

import * as fs from "fs";
import * as tl from "azure-pipelines-task-lib/task";
import * as yaml from "js-yaml";
import DockerComposeConnection from "./dockercomposeconnection";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any, imageDigestComposeFile?: string): any {
    return connection.getCombinedConfig(imageDigestComposeFile).then(output => {
        var removeBuildOptions = tl.getBoolInput("removeBuildOptions");
        if (removeBuildOptions) {
            var doc = yaml.safeLoad(output);
            for (var serviceName in doc.services || {}) {
                delete doc.services[serviceName].build;
            }
            output = yaml.safeDump(doc, {lineWidth: -1} as any);
        }

        var baseResolveDir = tl.getPathInput("baseResolveDirectory");
        if (baseResolveDir) {
            // This just searches the output string and replaces all
            // occurrences of the base resolve directory. This isn't
            // precisely accurate but is a good enough solution.
            var replaced = output;
            do {
                output = replaced;
                replaced = output.replace(baseResolveDir, ".");
            } while (replaced !== output);
        }

        var outputDockerComposeFile = tl.getPathInput("outputDockerComposeFile", true);

        fs.writeFileSync(outputDockerComposeFile, output);
    });
}
