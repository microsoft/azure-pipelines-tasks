import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');

describe('PackerBuild Suite', function() {
     this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    it('Runs successfully for windows template', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.invokedToolCount == 3, 'should have invoked tool once. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Creates output variables from packer log', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.invokedToolCount == 3, 'should have invoked tool once. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;secret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageStorageAccount;secret=false;]SouthIndia") != -1, "imageStorageAccount location output variable not set");
        done();
    });

    it('Should copy builtin template to temp location for windows template', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.invokedToolCount == 3, 'should have invoked tool once. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("copying .\\DefaultTemplates\\default.windows.template.json to F:\\somedir\\tempdir\\100") != -1, "built-in template should be copied to temp location");
        done();
    });

    it('Should invoke three packer commands - fix, validate and build', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.invokedToolCount == 3, 'should have invoked tool once. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("packer fix -validate=false") != -1, "packer fix command not called");
        assert(tr.stdout.indexOf("packer validate") != -1, "packer validate command not called");
        assert(tr.stdout.indexOf("packer build -force") != -1, "packer build with force command not called");
        done();
    });

    it('should fail if builtin template does not exist or copy fails', (done:MochaDone) => {
        process.env["__copy_fails__"] = "true";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__copy_fails__"] = "false";        

        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf("copy failed!!") != -1, "error message should be right");               
        done();
    });

    it('should fail if os type is not supported', (done:MochaDone) => {
        process.env["__ostype__"] = "random";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__ostype__"] = "windows";

        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf("##vso[task.issue type=error;]loc_mock_OSTypeNotSupported") != -1, "error message should be right");               
        done();
    });

    it('should fail if packer does not exist', (done:MochaDone) => {
        process.env["__packer_exists__"] = "false";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__packer_exists__"] = null;

        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf("##vso[task.complete result=Failed;]Error: Not found packer") != -1, "error message should be right");               
        done();
    });

    it('should fail if packer fix exits with non zero code', (done:MochaDone) => {
        process.env["__packer_fix_fails__"] = "true";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__packer_fix_fails__"] = "false";        

        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 1, 'should not invoke packer validate and build commands. actual: ' + tr.invokedToolCount);        
        assert(tr.stdout.indexOf("packer fix failed\r\nsome error") != -1, "error message should be right");               
        done();
    });

    it('should fail if packer validate exits with non zero code', (done:MochaDone) => {
        process.env["__packer_validate_fails__"] = "true";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__packer_validate_fails__"] = "false";        

        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 2, 'should not invoke packer build command. actual: ' + tr.invokedToolCount);        
        assert(tr.stdout.indexOf("packer validate failed\r\nsome error") != -1, "error message should be right");               
        done();
    });

    it('should fail if packer build exits with non zero code', (done:MochaDone) => {
        process.env["__packer_build_fails__"] = "true";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__packer_build_fails__"] = "false";        

        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 3, 'all 3 commands should have been invoked. actual: ' + tr.invokedToolCount);        
        assert(tr.stdout.indexOf("packer build failed\r\nsome error") != -1, "error message should be right");
        done();
    });

    it('should succeed even if output variables cannot be parsed from packer log', (done:MochaDone) => {
        process.env["__packer_build_no_output__"] = "true";
        let tp = path.join(__dirname, 'L0WindowsFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__packer_build_no_output__"] = "false";

        assert(tr.succeeded, 'task should still succeed even if output is not parsed properly');
        assert(tr.invokedToolCount == 3, 'all 3 commands should have been invoked. actual: ' + tr.invokedToolCount);        
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;secret=false;]") == -1, "should not try to set output variable");         
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageStorageAccount;secret=false;]") == -1, "should not try to set output variable");
        assert(tr.stdout.indexOf("loc_mock_ImageURIOutputVariableNotFound") != -1, "should show proper console message");         
        assert(tr.stdout.indexOf("loc_mock_StorageAccountLocationOutputVariableNotFound") != -1, "should show proper console message");               
        done();
    });

    it('parser should parse space and tabs', (done:MochaDone) => {
        process.env["__build_output__"] = "Executed Successfully OSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\tStorageAccountLocation: SouthIndia some random string\n";
        let tp = path.join(__dirname, 'L0Parser.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;secret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageStorageAccount;secret=false;]SouthIndia") != -1, "imageStorageAccount location output variable not set");
        done();
    });

    it('parser should parse LF and CR', (done:MochaDone) => {
        process.env["__build_output__"] = "Executed Successfully\n OSDiskUri:   https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\r\nStorageAccountLocation: SouthIndia\r some random string\n";
        let tp = path.join(__dirname, 'L0Parser.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;secret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
        assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageStorageAccount;secret=false;]SouthIndia") != -1, "imageStorageAccount location output variable not set");
        done();
    });

    it('copyFiles should not create dest if it exists', (done:MochaDone) => {
        process.env["__source_path_exists__"] = true;
        process.env["__dest_path_exists__"] = true;
        
        let tp = path.join(__dirname, 'L0Utilities.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
             
        assert(tr.stdout.indexOf("creating path: F:\\somedir\\tempdir\\100") == -1, "dest should not be created");
        assert(tr.stdout.indexOf("copying F:\\somedir\\tempdir\\100 to") != -1, "copy should be done");
        done();
    });

    it('copyFiles should create dest if it does not exist', (done:MochaDone) => {
        process.env["__source_path_exists__"] = true;
        process.env["__dest_path_exists__"] = false;
        
        let tp = path.join(__dirname, 'L0Utilities.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["__dest_path_exists__"] = true;
              
        assert(tr.stdout.indexOf("creating path: F:\\somedir\\tempdir\\100") != -1, "dest should be created");
        assert(tr.stdout.indexOf("copying F:\\somedir\\tempdir\\100 to") != -1, "copy should be done");
        done();
    });
});
