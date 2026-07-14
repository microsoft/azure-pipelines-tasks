import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('MicrosoftSqlDeployment Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        } catch (error) {
            console.log('STDERR', tr.stderr);
            console.log('STDOUT', tr.stdout);
            throw error;
        }
    }

    before(() => {
        process.env['SYSTEM_DEBUG'] = 'true';
    });

    after(() => {
        // Cleanup
    });

    it('should fail if action input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingAction.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when action is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail if path input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when path is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail if connectionString input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingConnectionString.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when connectionString is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail on invalid file extension', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0InvalidFileExtension.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed with invalid file extension');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('InvalidFileExtension') >= 0, 'should display invalid file extension error');
        }, tr);
    });

    it('should fail when firewallRuleManagement is true but azureSubscription is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0FirewallWithoutAzureSubscription.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when firewall requires azure subscription');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('FirewallManagementRequiresAzureSubscription') >= 0, 'should display firewall requires azure subscription error');
        }, tr);
    });

    it('should succeed with valid dacpac inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidDacpacInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid dacpac inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('DACPAC') >= 0, 'should detect DACPAC file type');
        }, tr);
    });

    it('should succeed with valid sql script inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidSqlScriptInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid sql script inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('SQL') >= 0, 'should detect SQL file type');
        }, tr);
    });

    it('should succeed with valid sqlproj inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidSqlProjInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid sqlproj inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('SQLPROJ') >= 0, 'should detect SQLPROJ file type');
        }, tr);
    });

    // SqlPackage discovery tests
    it('should fail when SqlPackage is not found anywhere', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when SqlPackage is not found');
            assert(tr.stdout.indexOf('SqlPackageNotFound') >= 0 || tr.errorIssues.some(e => e.includes('SqlPackage not found')), 
                'should display SqlPackage not found error');
        }, tr);
    });

    it('should succeed when SqlPackage is found via user-provided path', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageFromUserPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via user path');
            assert(tr.stdout.indexOf('SqlPackageFound') >= 0 || tr.stdout.indexOf('custom/path/sqlpackage') >= 0, 
                'should report SqlPackage found at user-provided path');
        }, tr);
    });

    it('should succeed when SqlPackage is found via dotnet tool', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageFromDotnetTool.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via dotnet tool');
            assert(tr.stdout.indexOf('SqlPackageFound') >= 0 || tr.stdout.indexOf('.dotnet') >= 0, 
                'should report SqlPackage found at dotnet tool location');
        }, tr);
    });

    it('should fail when user-provided SqlPackage path does not exist', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageUserPathNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should fail when user-provided SqlPackage path does not exist');
            assert(tr.stdout.indexOf('SqlPackageNotFoundAtPath') >= 0 || tr.errorIssues.some(e => e.includes('not found at specified path')), 
                'should display SqlPackage not found at path error');
        }, tr);
    });

    // sqlcmd discovery tests
    it('should fail when user-provided sqlcmd path does not exist', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlcmdUserPathNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should fail when user-provided sqlcmd path does not exist');
            assert(tr.stdout.indexOf('SqlcmdNotFoundAtPath') >= 0 || tr.errorIssues.some(e => e.includes('sqlcmd not found at specified path')), 
                'should display sqlcmd not found at path error');
        }, tr);
    });

    it('should succeed when sqlcmd is found via user-provided path', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlcmdFromUserPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when sqlcmd is found via user path');
            assert(tr.stdout.indexOf('SqlcmdFound') >= 0 || tr.stdout.indexOf('custom/path/sqlcmd') >= 0, 
                'should report sqlcmd found at user-provided path');
        }, tr);
    });

    it('should succeed when sqlcmd is found on PATH', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlcmdFromPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when sqlcmd is found on PATH');
            assert(tr.stdout.indexOf('SqlcmdFound') >= 0 || tr.stdout.indexOf('/usr/bin/sqlcmd') >= 0, 
                'should report sqlcmd found on PATH');
        }, tr);
    });

    // TODO: Add more tests as implementation progresses
    // - SqlPackage discovery and execution
    // - sqlcmd discovery/auto-install and execution
    // - Firewall management with Azure subscription
    // - SQL project build
    // - Connection string masking
    // - Output variable setting
});
