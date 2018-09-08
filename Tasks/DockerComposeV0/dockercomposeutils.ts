"use strict";

import * as tl from "vsts-task-lib/task";

export function findDockerFile(dockerfilepath: string): string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');     
        var allFiles = tl.find(buildFolder);
        var matchingResultsFiles = tl.match(allFiles, dockerfilepath, buildFolder, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
        }

        return matchingResultsFiles[0];
    }
    else {
        tl.debug(tl.loc('ContainerPatternNotFound'));
        return dockerfilepath;
    }
}
