import * as path from 'path';

import * as task from 'azure-pipelines-task-lib/task';

/**
 * Like `prependPath` from azure-pipelines-tool-lib, but does not check whether the directory exists.
 * TODO move this to azure-pipelines-tool-lib
 */
export function prependPathSafe(toolPath: string) {
    task.assertAgent('2.115.0');

    console.log(task.loc('PrependPath', toolPath));
    const newPath: string = toolPath + path.delimiter + process.env['PATH'];
    task.debug('new Path: ' + newPath);
    process.env['PATH'] = newPath;

    // instruct the agent to set this path on future tasks
    console.log('##vso[task.prependpath]' + toolPath);
}
