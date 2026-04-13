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
        const generatedVariants: string[] = [];

        // Find all generated variants for this task
        for (const item of items) {
            const itemPath = path.join(generatedTasksPath, item);
            if (fs.statSync(itemPath).isDirectory() && item.startsWith(task)) {
                generatedVariants.push(item);
            }
        }

        // Find highest Node version across base task and all variants
        const baseNodeVersion = getNodeVersionFromTaskJson(task);
        let highestNodeVersion = baseNodeVersion;
        let highestVariant: string | null = baseNodeVersion ? task : null;

        for (const variant of generatedVariants) {
            const variantNodeVersion = getNodeVersionFromTaskJson(task, variant);
            if (variantNodeVersion !== null && (highestNodeVersion === null || variantNodeVersion > highestNodeVersion)) {
                highestNodeVersion = variantNodeVersion;
                highestVariant = variant;
            }
        }

        console.log(`Latest Node version: ${highestNodeVersion} (variant: ${highestVariant})`);

        // Determine test configurations
        const configs: string[] = [];
        const baseNodeVersions = getNodeVersionsFromTaskJson(task);
        const needsTestNode = TEST_NODE_VERSION !== null && TEST_NODE_VERSION !== highestNodeVersion;
        const isInPlaceUpdate = TEST_NODE_VERSION !== null && 
                               highestNodeVersion !== null &&
                               baseNodeVersions.includes(TEST_NODE_VERSION) && 
                               baseNodeVersions.includes(highestNodeVersion);

        // Add TEST_NODE_VERSION configuration
        if (needsTestNode) {
            const testNodeVariant = generatedVariants.find(v => 
                getNodeVersionFromTaskJson(task, v) === TEST_NODE_VERSION
            );

            if (testNodeVariant) {
                configs.push(testNodeVariant);
            } else if (baseNodeVersions.includes(TEST_NODE_VERSION)) {
                configs.push(isInPlaceUpdate ? `${task}@Node${TEST_NODE_VERSION}` : task);
            }
        }

        // Add highest Node version configuration
        if (highestVariant) {
            const configName = (highestVariant === task && isInPlaceUpdate) 
                ? `${task}@Node${highestNodeVersion}` 
                : highestVariant;
            
            if (!configs.includes(configName)) {
                configs.push(configName);
            }
        }

        // Default to base task if no configs found
        if (configs.length === 0) {
            configs.push(task);
        }

        console.log(`Test configurations: ${configs.join(', ')}`);
        return configs;
    } catch (error) {
        console.error(`Error reading subdirectories: ${error}`);
        return [task];
    }
}

function getTaskJsonPath(taskName: string, buildConfig?: string): string {
    if (buildConfig) {
        const generatedPath = path.join(RepoRoot, '_generated', buildConfig, 'task.json');
        if (fs.existsSync(generatedPath)) {
            return generatedPath;
        }
    }
    return path.join(RepoRoot, 'Tasks', taskName, 'task.json');
}

function extractNodeVersions(execution: any): number[] {
    const versions: number[] = [];
    for (const handler in execution) {
        if (handler.startsWith('Node')) {
            const match = handler.match(/Node(\d+)/);
            if (match) {
                const version = parseInt(match[1]);
                if (!versions.includes(version)) {
                    versions.push(version);
                }
            }
        }
    }
    return versions.sort((a, b) => a - b);
}

export function getNodeVersionsFromTaskJson(taskName: string, buildConfig?: string): number[] {
    try {
        const taskJsonPath = getTaskJsonPath(taskName, buildConfig);
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        return extractNodeVersions(taskJson.execution || {});
    } catch (error) {
        console.error(`Error reading task.json for ${taskName}: ${error}`);
        return [];
    }
}

function getNodeVersionFromTaskJson(taskName: string, buildConfig?: string): number | null {
    try {
        const taskJsonPath = getTaskJsonPath(taskName, buildConfig);
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        const versions = extractNodeVersions(taskJson.execution || {});
        
        return versions.length > 0 ? Math.max(...versions) : null;
    } catch (error) {
        console.error(`Error reading task.json for ${taskName}: ${error}`);
        return null;
    }
}

export function getNodeVersionForTask(taskName: string, buildConfig?: string): number | null {
    // Check for @Node marker in buildConfig (for in-place updates like "UseDotNetV2@Node20")
    if (buildConfig?.includes('@Node')) {
        const match = buildConfig.match(/@Node(\d+)$/);
        if (match) {
            return parseInt(match[1]);
        }
    }
    
    // Try to get Node version from build config, or fall back to base task
    const nodeVersion = buildConfig 
        ? getNodeVersionFromTaskJson(taskName, buildConfig) 
        : getNodeVersionFromTaskJson(taskName);
    
    return nodeVersion;
}