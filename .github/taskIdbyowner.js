// /workspaces/azure-pipelines-tasks $ node ./.github/taskIdbyowner.js

const fs = require('fs');
const path = require('path');

const codeownersFilePath = '/workspaces/azure-pipelines-tasks/.github/CODEOWNERS';
const teamName = '@microsoft/azure-artifacts-packages';

function extractTasksOwnedByTeam(filePath, team) {
    const tasks = [];
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    lines.forEach(line => {
        if (line.includes(team)) {
            const taskPath = line.split(/\s+/)[0];
            tasks.push(taskPath);
        }
    });
    return tasks;
}

function extractTaskId(taskPath) {
    const taskJsonPath = path.join(taskPath, 'task.json');
    if (fs.existsSync(taskJsonPath)) {
        const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'));
        return taskData.id || null;
    }
    return null;
}

// Extract tasks owned by the specified team
const tasksOwnedByTeam = extractTasksOwnedByTeam(codeownersFilePath, teamName);

// Extract and print the task IDs for each task
tasksOwnedByTeam.forEach(task => {
    const taskId = extractTaskId(task);
    if (taskId) {
        console.log(`Task Path: ${task}, Task ID: ${taskId}`);
    } else {
        console.log(`Task Path: ${task}, Task ID: Not Found`);
    }
});