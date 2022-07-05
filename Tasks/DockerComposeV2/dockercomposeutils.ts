"use strict";

import * as tl from "azure-pipelines-task-lib/task";

export function findDockerFile(dockerfilepath: string, currentWorkingDirectory: string = ""): string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        var rootPath = currentWorkingDirectory.length > 0 ? currentWorkingDirectory : tl.getVariable('System.DefaultWorkingDirectory');     
        var allFiles = tl.find(rootPath);
        var matchingResultsFiles = tl.match(allFiles, dockerfilepath, rootPath, { matchBase: true });

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
