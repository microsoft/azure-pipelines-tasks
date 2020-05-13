import tl = require('azure-pipelines-task-lib/task');
import { setAnalysisVariables } from "../src/utilities";
import path = require("path");

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function executePythonTool(commandToExecute: string){
    var pythonPath = tl.getInput("pythonInterpreter");
    if (!pythonPath)
    {
        pythonPath = tl.which('python');
    }
    var pythonTool = tl.tool(pythonPath);
    var errors = [];
    pythonTool.on('stderr', function (data) {
        errors.push((data || '').toString());
    });
    const successRegex = /\d{4}-[0-1]\d-[0-3]\dT[0-2]\d:[0-9]\d:[0-9]\d.\d{7}Z .*:.*:\s*FINISHED: SUCCESS\s*$/;
    const failedRegex = /^\d{4}-[0-1]\d-[0-3]\dT[0-2]\d:[0-9]\d:[0-9]\d.\d{7}Z .*:.*:\s*FINISHED: FAILED\s*$/
    pythonTool.on('stdout', function (data) {
        let successMatch = successRegex.exec(data.toString());
        if(successMatch)
        {
            tl.setResult(tl.TaskResult.Succeeded, "");
            return;
        }

        let failedMatch = failedRegex.exec(data.toString());
        if(failedMatch)
        {
            tl.setResult(tl.TaskResult.Failed, "");
            return;
        }
    });
    await pythonTool.line(commandToExecute).exec().fail(error => {
        errors.forEach(line => tl.error(line));
        throw error;
    });
}

async function runAnalysis() {
    try {
        setAnalysisVariables();
        // Create the tool runner

        await executePythonTool("-m pip install aa");
        await executePythonTool(" aa.run()")
        
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

runAnalysis().then(() => {
    // do nothing
}, (reason) => {
    tl.setResult(tl.TaskResult.Failed, reason);
});

