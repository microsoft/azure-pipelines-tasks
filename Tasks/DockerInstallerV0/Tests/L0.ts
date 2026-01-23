import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DockerInstallerV0 Suite', function () {
    this.timeout(60000);

    before(() => {
    });

    after(() => {
    });

    it('should have Node24 execution handler', () => {
        const taskJsonPath = path.join(__dirname, '..', 'task.json');
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        
        assert(taskJson.execution, 'task.json should have an execution section');
        assert(taskJson.execution.Node24, 'task.json should have a Node24 execution handler');
        assert(taskJson.execution.Node24.target, 'Node24 handler should have a target');
        assert.strictEqual(taskJson.execution.Node24.target, 'src//dockertoolinstaller.js', 'Node24 handler target should be src//dockertoolinstaller.js');
    });

    it('should have all required Node execution handlers', () => {
        const taskJsonPath = path.join(__dirname, '..', 'task.json');
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        
        const requiredHandlers = ['Node10', 'Node16', 'Node20_1', 'Node24'];
        const executionHandlers = Object.keys(taskJson.execution || {});
        
        for (const handler of requiredHandlers) {
            assert(executionHandlers.includes(handler), `task.json should have ${handler} execution handler`);
        }
    });

    it('should have valid task.json metadata', () => {
        const taskJsonPath = path.join(__dirname, '..', 'task.json');
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        
        assert(taskJson.id, 'task.json should have an id');
        assert(taskJson.name, 'task.json should have a name');
        assert.strictEqual(taskJson.name, 'DockerInstaller', 'task name should be DockerInstaller');
        assert(taskJson.version, 'task.json should have a version');
        assert(taskJson.author, 'task.json should have an author');
        assert.strictEqual(taskJson.category, 'Tool', 'task category should be Tool');
    });

    it('should have required inputs defined', () => {
        const taskJsonPath = path.join(__dirname, '..', 'task.json');
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        
        assert(taskJson.inputs, 'task.json should have inputs');
        
        const inputNames = taskJson.inputs.map((input: any) => input.name);
        assert(inputNames.includes('dockerVersion'), 'task should have dockerVersion input');
        assert(inputNames.includes('releaseType'), 'task should have releaseType input');
        
        const dockerVersionInput = taskJson.inputs.find((input: any) => input.name === 'dockerVersion');
        assert(dockerVersionInput.required, 'dockerVersion input should be required');
        assert(dockerVersionInput.defaultValue, 'dockerVersion input should have a default value');
    });

    it('should satisfy Docker demand', () => {
        const taskJsonPath = path.join(__dirname, '..', 'task.json');
        const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
        
        assert(taskJson.satisfies, 'task.json should have satisfies section');
        assert(taskJson.satisfies.includes('Docker'), 'task should satisfy Docker demand');
    });

    it('Runs successfully with default inputs', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerDefault.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
        }
    });

    it('Fails when docker download fails', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerFail.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.failed, 'task should have failed');
        }
    });
});
