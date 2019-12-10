import tl = require('azure-pipelines-task-lib/task');

(async () => {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        
        tl.setResult(tl.TaskResult.Succeeded, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
})();
