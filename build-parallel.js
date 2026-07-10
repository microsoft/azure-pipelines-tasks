#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const minimist = require('minimist');
const fs = require('fs');

/**
 * Convert task glob pattern to pnpm workspace filters using path-based approach
 * @param {string} taskPattern - Task pattern (e.g., "@(TaskA|TaskB|TaskC)" or "TaskName")
 * @returns {string[]} - Array of --filter arguments for pnpm
 */
function convertTaskPatternToWorkspaceFilters(taskPattern) {
    if (!taskPattern) {
        return [];
    }

    // Handle @(task1|task2|task3) pattern - convert to single filter with path pattern
    if (taskPattern.startsWith('@(') && taskPattern.endsWith(')')) {
        const tasksString = taskPattern.slice(2, -1); // Remove @( and )
        const tasks = tasksString.split('|').map(task => task.trim());
        
        if (tasks.length === 0) {
            return [];
        } else if (tasks.length === 1) {
            return ['--filter', `"./Tasks/${tasks[0]}"`];
        } else {
            // Create a single filter pattern that matches multiple task paths
            const pathPattern = `./Tasks/{${tasks.join(',')}}`;
            return ['--filter', `"${pathPattern}"`];
        }
    }
    
    // Handle single task or other patterns - use path-based filter
    return ['--filter', `"./Tasks/${taskPattern}"`];
}

/**
 * Convert parsed arguments to workspace filter arguments for pnpm
 * @param {object} argv - Parsed minimist arguments
 * @returns {string[]} - Converted arguments for pnpm
 */
function convertArgsToWorkspaceArgs(argv) {
    const convertedArgs = [];
    
    // Handle task parameter
    if (argv.task) {
        const taskFilters = convertTaskPatternToWorkspaceFilters(argv.task);
        convertedArgs.push(...taskFilters);
    }
    
    // Handle other arguments (excluding task and the command)
    Object.keys(argv).forEach(key => {
        if (key !== 'task' && key !== '_') {
            const value = argv[key];
            if (typeof value === 'boolean' && value) {
                convertedArgs.push(`--${key}`);
            } else if (typeof value !== 'boolean') {
                convertedArgs.push(`--${key}=${value}`);
            }
        }
    });
    
    return convertedArgs;
}

/**
 * Executes a command with arguments and returns a promise
 * @param {string} command - The command to execute
 * @param {string[]} args - Array of arguments
 * @param {object} options - Spawn options
 * @returns {Promise<number>} - Exit code
 */
function executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        // For shell commands, we need to properly quote arguments that contain special characters
        const quotedArgs = args.map(arg => {
            // Quote arguments that contain pipes, parentheses, or spaces
            if (arg.includes('|') || arg.includes('(') || arg.includes(')') || arg.includes(' ')) {
                return `"${arg}"`;
            }
            return arg;
        });
        
        const child = spawn(command, quotedArgs, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        child.on('close', (code) => {
            resolve(code);
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Run parallel build command
 * @param {string[]} additionalArgs - Additional arguments to pass to the commands
 */
async function runBuild(additionalArgs = []) {
    // Parse arguments using minimist (same as make.js)
    const argv = minimist(additionalArgs);

    failIfTasksMissing(argv);

    // First run pre-build steps
    console.log('Running pre-build steps...');
    try {
        const preBuildArgs = ['make.js', 'build', '--onlyPreBuildSteps', '--enableConcurrentTaskBuild', ...additionalArgs];
        const preBuildExitCode = await executeCommand('node', preBuildArgs);
        if (preBuildExitCode !== 0) {
            console.error('Pre-build steps failed');
            process.exit(preBuildExitCode);
        }
    } catch (error) {
        console.error('Error running pre-build steps:', error.message);
        process.exit(1);
    }

    // Then run parallel build
    const pnpmPath = path.join(__dirname, 'node_modules', '.bin', 'pnpm');
    const workspaceArgs = convertArgsToWorkspaceArgs(argv);
    const args = [
        '-r',
        '--report-summary',
        '--aggregate-output',
        '--reporter=append-only',
        '--workspace-concurrency=2',
        ...workspaceArgs,  // Move workspace filters before 'run'
        'run',
        'build',
        '--skipPrebuildSteps',
        '--enableConcurrentTaskBuild'
    ];

    console.log('Running parallel build...');
    console.log('pnpm command:', 'pnpm', args.join(' '));
    try {
        const exitCode = await executeCommand(pnpmPath, args);
        printBuildSummary();
        process.exit(exitCode);
    } catch (error) {
        console.error('Error running build:', error.message);
        process.exit(1);
    }
}

/**
 * Run parallel server build command
 * @param {string[]} additionalArgs - Additional arguments to pass to the commands
 */
async function runServerBuild(additionalArgs = []) {
    // Parse arguments using minimist (same as make.js)
    const argv = minimist(additionalArgs);
    failIfTasksMissing(argv);

    // First run pre-build steps
    console.log('Running pre-build steps for server build...');
    try {
        const preBuildArgs = ['make.js', 'build', '--onlyPreBuildSteps', '--enableConcurrentTaskBuild', ...additionalArgs];
        const preBuildExitCode = await executeCommand('node', preBuildArgs);
        if (preBuildExitCode !== 0) {
            console.error('Pre-build steps failed for server build');
            process.exit(preBuildExitCode);
        }
    } catch (error) {
        console.error('Error running pre-build steps for server build:', error.message);
        process.exit(1);
    }

    // Then run parallel server build
    const pnpmPath = path.join(__dirname, 'node_modules', '.bin', 'pnpm');
    const workspaceArgs = convertArgsToWorkspaceArgs(argv);
    const args = [
        '-r',
        '--report-summary',
        '--aggregate-output',
        '--reporter=append-only',
        '--workspace-concurrency=2',
        ...workspaceArgs,  // Move workspace filters before 'run'
        'run',
        'serverBuild',
        '--skipPrebuildSteps',
        '--enableConcurrentTaskBuild'
    ];

    console.log('Running parallel server build...');
    console.log('pnpm command:', 'pnpm', args.join(' '));
    try {
        const exitCode = await executeCommand(pnpmPath, args);
        printBuildSummary();
        process.exit(exitCode);
    } catch (error) {
        console.error('Error running server build:', error.message);
        process.exit(1);
    }
}

// Parse command line arguments
const command = process.argv[2];
const additionalArgs = process.argv.slice(3); // Capture all arguments after the command

switch (command) {
    case 'build':
        runBuild(additionalArgs);
        break;
    case 'serverBuild':
        runServerBuild(additionalArgs);
        break;
    default:
        console.log('Usage: node build-parallel.js [build|serverBuild] [additional arguments...]');
        console.log('Commands:');
        console.log('  build       - Run parallel build');
        console.log('  serverBuild - Run parallel server build');
        console.log('');
        console.log('Examples:');
        console.log('  node build-parallel.js build --task "MyTask"');
        console.log('  node build-parallel.js serverBuild --task "@(TaskA|TaskB|TaskC)"');
        console.log('');
        console.log('Note: Task patterns are converted to path-based --filter arguments for pnpm workspace filtering');
        console.log('      Multiple tasks use a single filter pattern:');
        console.log('        - Glob pattern: --task "@(Task1|Task2|Task3)" → --filter "./Tasks/{Task1,Task2,Task3}"');
        console.log('        - Single task: --task "Task1" → --filter "./Tasks/Task1"');
        process.exit(1);
}

// Print build summary
const printBuildSummary = () => {
    const summaryPath = path.join(__dirname, 'pnpm-exec-summary.json');
    if (!fs.existsSync(summaryPath)) {
        console.log('No build summary found.');
        return;
    }
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const execStatus = summary.executionStatus || {};

    let total = 0, success = 0, failed = 0, skipped = 0, running = 0;
    for (const task in execStatus) {
        total++;
        const status = execStatus[task].status;
        if (status === 'passed') success++;
        else if (status === 'failure') failed++;
        else if (status === 'running') running++;
        else skipped++;
    }

    console.log('');
    console.log('📊 BUILD SUMMARY');
    console.log('================================================================================');
    console.log(` Total tasks built:        ${total}`);
    console.log(` ✅ Successful:            ${success}`);
    console.log(` ❌ Failed:                ${failed}`);
    console.log(` ⏭️  Skipped:               ${skipped}`);
    console.log(` 🟡 Running:               ${running}`);
    console.log('===================================');
};

/**
 * Checks if all requested tasks exist in ./Tasks directory. Exits with error if any are missing.
 */
function failIfTasksMissing(argv) {
    const argvTask = argv.task;
    let requestedTasks = [];
    if (argvTask) {
        if (argvTask.startsWith('@(') && argvTask.endsWith(')')) {
            requestedTasks = argvTask.slice(2, -1).split('|').map(t => t.trim());
        } else {
            requestedTasks = [argvTask];
        }
    }
    if (requestedTasks.length) {
        // Check existence in ./Tasks directory
        const tasksDir = path.join(__dirname, 'Tasks');
        let missingTasks = [];
        for (const t of requestedTasks) {
            const taskPath = path.join(tasksDir, t);
            if (!fs.existsSync(taskPath)) {
                missingTasks.push(t);
            }
        }
        if (missingTasks.length) {
            console.error(`Error: The following tasks do not exist: ${missingTasks.join(', ')}`);
            process.exit(2);
        }
    }
}