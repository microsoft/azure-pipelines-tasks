import fs from 'fs';
import path from 'path';

const RepoRoot = path.join(__dirname, '..', '..', '..', '..');

// Get test Node version from environment variable (e.g., "20" or "24")
const TEST_NODE_VERSION = process.env.TEST_NODE_VERSION ? parseInt(process.env.TEST_NODE_VERSION) : null;

export function getBuildConfigs(task: string): string[] {
    const generatedTasksPath = path.join(RepoRoot, '_generated');

    console.log(`checking buildconfig for ${task}`);
    console.log(`Test Node version from TEST_NODE_VERSION: ${TEST_NODE_VERSION || 'not set'}`);
    
    try {
        const items = fs.readdirSync(generatedTasksPath);
        const tasksToTest: string[] = [];

        // Find all generated variants for this task
        for (const item of items) {
            const itemPath = path.join(generatedTasksPath, item);
            const stats = fs.statSync(itemPath);

            if (stats.isDirectory() && item.startsWith(task)) {
                tasksToTest.push(item);
            }
        }

        // Get the latest Node version from base task or generated configs
        let latestNodeVersion: number | null = null;
        let latestVariantName: string | null = null;

        // Check base task first (handles Node24_overwrite scenario)
        const baseTaskNodeVersion = getNodeVersionFromTaskJson(task);
        if (baseTaskNodeVersion !== null) {
            latestNodeVersion = baseTaskNodeVersion;
            latestVariantName = task;
            console.log(`Base task "${task}" uses Node ${baseTaskNodeVersion}`);
        }

        // Check all generated variants to find the highest Node version
        for (const variant of tasksToTest) {
            const variantNodeVersion = getNodeVersionFromTaskJson(task, variant);
            if (variantNodeVersion !== null && (latestNodeVersion === null || variantNodeVersion > latestNodeVersion)) {
                latestNodeVersion = variantNodeVersion;
                latestVariantName = variant;
            }
        }

        console.log(`Latest Node version detected: ${latestNodeVersion} (variant: ${latestVariantName})`);

        // Build final test configuration list
        const finalTestConfigs: string[] = [];

        // Add test Node version variant if specified and different from latest
        if (TEST_NODE_VERSION !== null) {
            if (latestNodeVersion === null || TEST_NODE_VERSION !== latestNodeVersion) {
                // Find variant matching test node version
                const testnodeVariant = tasksToTest.find(t => {
                    const nodeVersion = getNodeVersionFromTaskJson(task, t);
                    return nodeVersion === TEST_NODE_VERSION;
                });

                if (testnodeVariant) {
                    finalTestConfigs.push(testnodeVariant);
                    console.log(`Adding test Node ${TEST_NODE_VERSION} variant: ${testnodeVariant}`);
                } else {
                    // Check if base task supports the test Node version
                    const baseTaskSupportedVersions = getNodeVersionsFromTaskJson(task);
                    if (baseTaskSupportedVersions.includes(TEST_NODE_VERSION)) {
                        finalTestConfigs.push(task);
                        console.log(`Adding base task for test Node ${TEST_NODE_VERSION} (base task supports multiple Node versions: [${baseTaskSupportedVersions.join(', ')}])`);
                    } else {
                        console.log(`Warning: No variant found for test Node ${TEST_NODE_VERSION}`);
                    }
                }
            } else {
                console.log(`Test Node ${TEST_NODE_VERSION} matches latest Node version, will only test once`);
            }
        }

        // Add latest Node version variant
        if (latestVariantName !== null) {
            if (latestVariantName === task && !finalTestConfigs.includes(task)) {
                finalTestConfigs.push(task);
                console.log(`Adding base task for latest Node ${latestNodeVersion}`);
            } else if (latestVariantName !== task && !finalTestConfigs.includes(latestVariantName)) {
                finalTestConfigs.push(latestVariantName);
                console.log(`Adding latest Node ${latestNodeVersion} variant: ${latestVariantName}`);
            }
        }

        // If no configs found, default to base task
        if (finalTestConfigs.length === 0) {
            finalTestConfigs.push(task);
            console.log(`No specific configs found, using base task: ${task}`);
        }

        console.log(`Final test configurations for ${task}: ${finalTestConfigs.join(', ')}`);
        return finalTestConfigs;
    } catch (error) {
        console.error(`Error reading subdirectories: ${error}`);
        return [task];
    }
}

function getNodeVersionsFromTaskJson(taskName: string, buildConfig?: string): number[] {
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
                    const version = parseInt(match[1]);
                    if (!nodeVersions.includes(version)) {
                        nodeVersions.push(version);
                    }
                }
            }
        }
        
        return nodeVersions.sort((a, b) => a - b);
    } catch (error) {
        console.error(`Error reading task.json for ${taskName}: ${error}`);
        return [];
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

export function getNodeVersionForTask(taskName: string, buildConfig?: string): number | null {
    // Determine which Node version to install on the agent for this specific test configuration
    
    // If buildConfig is provided, get the highest Node version from that specific config
    if (buildConfig) {
        const configNodeVersion = getNodeVersionFromTaskJson(taskName, buildConfig);
        if (configNodeVersion !== null) {
            console.log(`Using Node version ${configNodeVersion} for task ${buildConfig}`);
            return configNodeVersion;
        }
    }
    
    // For base task, get the highest Node version from task.json
    const baseNodeVersion = getNodeVersionFromTaskJson(taskName);
    if (baseNodeVersion !== null) {
        console.log(`Using Node version ${baseNodeVersion} for task ${taskName}`);
        return baseNodeVersion;
    }

    return null;
}

