import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

describe('archiveFolder symlink handling', function () {
    this.timeout(30000);

    it('should follow symlinks and include real file contents in the zip', async () => {
        const tempDir = path.join(__dirname, 'temp', 'symlink-test');
        const outputDir = path.join(__dirname, 'temp');

        // Clean up from previous runs
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });

        // Create a real module with an index.js
        const realModuleDir = path.join(tempDir, 'node_modules', 'real-module');
        fs.mkdirSync(realModuleDir, { recursive: true });
        fs.writeFileSync(path.join(realModuleDir, 'index.js'), 'module.exports = { hello: "world" };');
        fs.writeFileSync(path.join(realModuleDir, 'package.json'), JSON.stringify({ name: 'real-module', version: '1.0.0' }));

        // Create a symlink to the real module
        const symlinkPath = path.join(tempDir, 'node_modules', 'symlinked-module');
        if (process.platform === 'win32') {
            execSync(`cmd /c mklink /D "${symlinkPath}" "${realModuleDir}"`);
        } else {
            fs.symlinkSync(realModuleDir, symlinkPath, 'dir');
        }

        // Verify symlink was created
        const symlinkStat = fs.lstatSync(symlinkPath);
        assert.ok(symlinkStat.isSymbolicLink(), 'Should have created a symlink');

        // Archive the folder using webdeployment-common's archiveFolder
        const zipPath = path.join(outputDir, 'symlink-test-output.zip');
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }

        const ziputility = require('azure-pipelines-tasks-webdeployment-common/ziputility');
        await ziputility.archiveFolder(tempDir, outputDir, 'symlink-test-output.zip');

        assert.ok(fs.existsSync(zipPath), 'Zip file should exist');

        // Extract and verify symlinked content is real files, not a text file with path
        const extractDir = path.join(outputDir, 'symlink-test-extracted');
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true, force: true });
        }

        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);

        const extractedSymlink = path.join(extractDir, 'node_modules', 'symlinked-module');
        const extractedIndex = path.join(extractedSymlink, 'index.js');

        // The symlinked-module should be a directory with real files, not a text file
        assert.ok(fs.existsSync(extractedSymlink), 'Extracted symlinked-module should exist');
        assert.ok(fs.statSync(extractedSymlink).isDirectory(), 'symlinked-module should be a directory, not a text file');
        assert.ok(fs.existsSync(extractedIndex), 'index.js should exist inside symlinked-module');

        const content = fs.readFileSync(extractedIndex, 'utf8');
        assert.ok(content.includes('hello'), 'index.js should contain the real module code');

        // Cleanup
        fs.rmSync(path.join(outputDir, 'symlink-test'), { recursive: true, force: true });
        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
    });
});
