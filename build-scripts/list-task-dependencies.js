'use strict';

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const minimatch = require('minimatch');

const repositoryRoot = path.resolve(__dirname, '..');
const reportDirectory = path.join(repositoryRoot, '.dependency-reports');
const sourceDirectories = ['Tasks', '_generated'];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findTaskDirectories(taskPattern) {
    const taskDirectories = [];

    sourceDirectories.forEach((sourceDirectory) => {
        const sourcePath = path.join(repositoryRoot, sourceDirectory);
        if (!fs.existsSync(sourcePath)) {
            return;
        }

        fs.readdirSync(sourcePath, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .filter((entry) => !taskPattern || minimatch(entry.name, taskPattern, { nocase: true }))
            .forEach((entry) => {
                const taskPath = path.join(sourcePath, entry.name);
                const packageJsonPath = path.join(taskPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    taskDirectories.push({
                        name: entry.name,
                        source: sourceDirectory,
                        path: taskPath,
                        packageJsonPath
                    });
                }
            });
    });

    return taskDirectories.sort((left, right) => {
        return `${left.source}/${left.name}`.localeCompare(`${right.source}/${right.name}`);
    });
}

function getResolvedVersion(lockFile, packageName) {
    if (!lockFile) {
        return 'lockfile missing';
    }

    if (lockFile.packages) {
        const packageEntry = lockFile.packages[`node_modules/${packageName}`];
        return packageEntry && packageEntry.version ? packageEntry.version : 'not resolved';
    }

    if (lockFile.dependencies && lockFile.dependencies[packageName]) {
        return lockFile.dependencies[packageName].version || 'not resolved';
    }

    return 'not resolved';
}

function markdownCell(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function collectRows(taskDirectories) {
    const rows = [];
    const errors = [];

    taskDirectories.forEach((task) => {
        try {
            const packageJson = readJson(task.packageJsonPath);
            const lockFilePath = path.join(task.path, 'package-lock.json');
            const lockFile = fs.existsSync(lockFilePath) ? readJson(lockFilePath) : null;

            ['dependencies', 'devDependencies'].forEach((dependencyType) => {
                Object.entries(packageJson[dependencyType] || {}).forEach(([packageName, declaredVersion]) => {
                    const resolvedVersion = declaredVersion.startsWith('file:')
                        ? 'local file dependency'
                        : getResolvedVersion(lockFile, packageName);

                    rows.push({
                        task: task.name,
                        source: task.source,
                        type: dependencyType,
                        packageName,
                        declaredVersion,
                        resolvedVersion
                    });
                });
            });
        } catch (error) {
            errors.push(`${task.source}/${task.name}: ${error.message}`);
        }
    });

    return { rows, errors };
}

function buildMarkdown(taskDirectories, result, taskPattern) {
    const generatedAt = new Date().toISOString();
    const lines = [
        '# Task Dependency Report',
        '',
        `Generated: ${generatedAt}`,
        `Scope: ${taskPattern ? `\`${taskPattern}\`` : 'all tasks'}`,
        '',
        `Tasks scanned: ${taskDirectories.length}`,
        `Dependency entries: ${result.rows.length}`,
        `Errors: ${result.errors.length}`,
        '',
        '| Task | Source | Type | Package | Declared Version | Resolved Version |',
        '| --- | --- | --- | --- | --- | --- |'
    ];

    result.rows.forEach((row) => {
        lines.push(`| ${markdownCell(row.task)} | ${markdownCell(row.source)} | ${markdownCell(row.type)} | ${markdownCell(row.packageName)} | ${markdownCell(row.declaredVersion)} | ${markdownCell(row.resolvedVersion)} |`);
    });

    if (result.errors.length > 0) {
        lines.push('', '## Errors', '');
        result.errors.forEach((error) => lines.push(`- ${markdownCell(error)}`));
    }

    return `${lines.join('\n')}\n`;
}

function main(argumentsList) {
    const parsedArguments = argumentsList || minimist(process.argv.slice(2), {
        string: ['task', 'output'],
        alias: { task: 't', output: 'o' },
        boolean: ['help'],
        default: { output: path.join(reportDirectory, `task-dependencies-${new Date().toISOString().replace(/[:.]/g, '-')}.md`) }
    });
    const argv = Object.assign({
        output: path.join(reportDirectory, `task-dependencies-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
    }, parsedArguments);

    if (argv.help) {
        console.log('Usage: node build-scripts/list-task-dependencies.js [--task <pattern>] [--output <path>]');
        return;
    }

    const taskDirectories = findTaskDirectories(argv.task);
    if (taskDirectories.length === 0) {
        throw new Error(`No task package.json files matched${argv.task ? ` pattern '${argv.task}'` : ''}.`);
    }

    const result = collectRows(taskDirectories);
    const markdown = buildMarkdown(taskDirectories, result, argv.task);
    const outputPath = path.resolve(repositoryRoot, argv.output);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, 'utf8');

    console.log(`Dependency report written to ${path.relative(repositoryRoot, outputPath)}`);
    console.log(`Tasks scanned: ${taskDirectories.length}`);
    console.log(`Dependency entries: ${result.rows.length}`);
    if (result.errors.length > 0) {
        console.warn(`Manifest errors: ${result.errors.length}`);
    }
}

module.exports = main;

if (require.main === module) {
    main();
}
