const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const fs = require('fs');

/**
 * Ensures that the directory exists, creating it if necessary
 */
function ensureDirectoryExists(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        console.log(`Directory does not exist, creating: ${directoryPath}`);
        try {
            fs.mkdirSync(directoryPath, { recursive: true });
            console.log(`Successfully created directory: ${directoryPath}`);
        } catch (err) {
            console.warn(`Failed to create directory: ${directoryPath}. Error: ${err.message}`);
        }
    } else {
        console.log(`Directory already exists: ${directoryPath}`);
    }
}

async function run() {
    try {
        // Get the path from task input
        const cachePath = tl.getPathInput('path', true);
        console.log(`Ensuring cache directory exists: ${cachePath}`);
        
        ensureDirectoryExists(cachePath);
        
        console.log('Directory preparation completed successfully');
    } catch (err) {
        console.warn(`Error occurred while ensuring directory exists: ${err.message}`);
        // We don't want to fail the task if directory creation fails,
        // as this is just a preparation step for the actual cache task
    }
}

run();