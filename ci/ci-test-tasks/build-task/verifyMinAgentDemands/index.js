const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const tl = require('azure-pipelines-task-lib/task');

const fileToJson = (...filePath) => {
    const file = path.join(...filePath);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file));
    }
};

// Verify that no tasks have min agent demands greater than whatever version of the agent is fully rolled out.
const verifyMinAgentDemands = async () => {
    console.log('Verifying min agent demands.');
    const octokit = new Octokit();
    const response = await octokit.repos.getLatestRelease({
        owner: 'microsoft', 
        repo: 'azure-pipelines-agent'
    });

    // Find the version of the agent that is fully rolled out
    const agentVersion = response.data.name.substring(1);
    console.log(`Latest version of the Agent that's fully rolled out is ${agentVersion}.`);

    const rootDir = path.join(__dirname, '..', '..');
    const taskList = fileToJson(rootDir, 'make-options.json').tasks;

    // Iterate all tasks and make sure none of them depend on a version higher than what's rolled out
    taskList.forEach(taskName => {
        const taskJson = fileToJson(rootDir, 'Tasks', taskName, 'task.json');
        if (taskJson) {
            const min = taskJson.minimumAgentVersion;

            if (min && semver.gt(min, agentVersion)) {
                tl.setResult(tl.TaskResult.Failed, `Error! Task ${taskName} has a minimum agent version of ${min} but the latest version of the Agent is ${agentVersion}.`);
            }
        } else {
            tl.setResult(tl.TaskResult.Failed, `Error! Task ${taskName} does not exist or does not have task.json file.`);
        }
    });
};

verifyMinAgentDemands();
