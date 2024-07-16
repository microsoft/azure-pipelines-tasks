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
