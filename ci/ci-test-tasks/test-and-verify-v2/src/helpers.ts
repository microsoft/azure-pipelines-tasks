import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..', '..', '..');

export function getBuildConfigs(task: string): string[] {
    console.log(`checking buildconfig for ${task}`);
    try {
        const items = fs.readdirSync(path.join(repoRoot, '_generated'));
        const tasksToTest: string[] = [];

        for (const item of items) {
            const itemPath = path.join('_generated', item);
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

export const pipelineVariable = (key: string, value: string) => ({ [key]: { value, isSecret: false } });
