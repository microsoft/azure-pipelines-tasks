
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const tl = require('azure-pipelines-task-lib/task');

const fileToJson = function(file) {
    return JSON.parse(fs.readFileSync(file).toString());
}

// Verify that no tasks have min agent demands greater than whatever version of the agent is fully rolled out.
console.log("Verifying min agent demands.");
var octokit = new Octokit();
octokit.repos.getLatestRelease({
    owner: "microsoft", 
    repo: "azure-pipelines-agent"
})
.then(({data}) => {
    // Find the version of the agent that is fully rolled out
    var agentVersion = data.name.substr(1);
    console.log(`Latest version of the Agent that's fully rolled out is ${agentVersion}.`);

    const rootDir = path.join(__dirname, '..', '..');
    const taskList = fileToJson(path.join(rootDir, 'make-options.json')).tasks;

    // Iterate all tasks and make sure none of them depend on a version higher than what's rolled out
    taskList.forEach(function(taskName) {
        var taskPath = path.join(rootDir, 'Tasks', taskName);
        if (!fs.existsSync(taskPath)) {
            throw new Error(`Task ${taskPath} does not exist`);
        }

        // Load the task.json
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (fs.existsSync(taskJsonPath)) {
            var taskDef = fileToJson(taskJsonPath);
            
            if (taskDef.minimumAgentVersion && 
                semver.gt(taskDef.minimumAgentVersion, agentVersion))
            {
                tl.setResult(tl.TaskResult.Failed, `Error! Task ${taskName} has a minimum agent version of ${taskDef.minimumAgentVersion} but the latest version of the Agent is ${agentVersion}.`);
            }
        }
    });
});