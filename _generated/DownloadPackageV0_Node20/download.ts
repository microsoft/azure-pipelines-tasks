var path = require('path')

import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function main(): Promise<void> {
	tl.setResult(tl.TaskResult.Failed, tl.loc("DeprecatedTask"));
}

main()
