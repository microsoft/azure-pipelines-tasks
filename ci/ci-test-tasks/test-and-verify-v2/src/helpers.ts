import fs from 'fs';
import path from 'path';

const RepoRoot = path.join(__dirname, '..', '..', '..', '..');

export function getBuildConfigs(task: string): string[] {
    const generatedTasksPath = path.join(RepoRoot, '_generated');

    console.log(`checking buildconfig for ${task}`);
    try {
        const items = fs.readdirSync(generatedTasksPath);
        const tasksToTest: string[] = [];

        for (const item of items) {
            const itemPath = path.join(generatedTasksPath, item);
            const stats = fs.statSync(itemPath);

            if (stats.isDirectory() && item.startsWith(task)) {
                tasksToTest.push(item);
            }
        }

        if (tasksToTest.length === 0) {
            tasksToTest.push(task);
        }
        return tasksToTest;
    } catch (error) {
        console.error(`Error reading subdirectories: ${error}`);
        return [task];
    }
}

function getNodeVersionFromTaskJson(taskName: string, buildConfig?: string): number | null {
    let taskJsonPath: string;
    
    if (buildConfig) {
        // Check _generated folder first for build configs
        taskJsonPath = path.join(RepoRoot, '_generated', buildConfig, 'task.json');
        if (!fs.existsSync(taskJsonPath)) {
            // Fall back to base task folder
            taskJsonPath = path.join(RepoRoot, 'Tasks', taskName, 'task.json');
        }
    } else {
        taskJsonPath = path.join(RepoRoot, 'Tasks', taskName, 'task.json');
    }

    try {
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        const execution = taskJson.execution || {};
        
        // Extract all Node versions from execution handlers
        const nodeVersions: number[] = [];
        
        for (const handler in execution) {
            if (handler.startsWith('Node')) {
                // Extract number from handler name (e.g., Node10 -> 10, Node20_1 -> 20, Node24 -> 24)
                const match = handler.match(/Node(\d+)/);
                if (match) {
                    nodeVersions.push(parseInt(match[1]));
                }
            }
        }
        
        // Return highest Node version
        if (nodeVersions.length > 0) {
            const maxVersion = Math.max(...nodeVersions);
            console.log(`Found Node versions for ${buildConfig || taskName}: [${nodeVersions.join(', ')}], using highest: ${maxVersion}`);
            return maxVersion;
        }
        
        console.log(`No Node execution handlers found in ${taskJsonPath}`);
        return null;
    } catch (error) {
        console.error(`Error reading task.json for ${taskName}: ${error}`);
        return null;
    }
}

export function getNodeVersionForTask(taskName: string): number | null {
    // Get all build configs for this task
    const buildConfigs = getBuildConfigs(taskName);
    
    // Try to find Node version from any of the build configs
    for (const buildConfig of buildConfigs) {
        const nodeVersion = getNodeVersionFromTaskJson(taskName, buildConfig);
        if (nodeVersion !== null) {
            return nodeVersion;
        }
    }
    
    // If no build configs have Node version, try base task
    return getNodeVersionFromTaskJson(taskName);
}
