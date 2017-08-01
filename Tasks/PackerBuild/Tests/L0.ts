import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');

function runValidations(validator: () => void, tr, done) {
    try {
        validator();
        done();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        done(error);
    }
}

describe('PackerBuild Suite', function() {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    if(tl.osType().match(/^Win/)) {
        it('Runs successfully for windows template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('Runs successfully for custom template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0CustomTemplate.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('Runs successfully for windows custom image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('Creates output variables from packer log', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            runValidations(() => {
                assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
                assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            }, tr, done);
        });

        it('Creates output variables from packer log for custom template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0CustomTemplate.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            runValidations(() => {
                assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
                assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            }, tr, done);
        });

        it('Creates output variables from packer log for custom windows base image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Should copy builtin template to temp location for windows template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("copying basedir\\DefaultTemplates\\default.windows.template.json to F:\\somedir\\tempdir\\100") != -1, "built-in template should be copied to temp location");
            done();
        });



        it('Should copy builtin template to temp location for windows template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("copying basedir\\DefaultTemplates\\custom.windows.template.json to F:\\somedir\\tempdir\\100") != -1, "custom image template should be copied to temp location");
            done();
        });

        it('Should invoke three packer commands - fix, validate and build', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("packer fix -validate=false") != -1, "packer fix command not called");
            assert(tr.stdout.indexOf("packer validate") != -1, "packer validate command not called");
            assert(tr.stdout.indexOf("packer build -force") != -1, "packer build with force command not called");
            done();
        });

        it('Should write output of packer fix to updated template file', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("packer fix -validate=false") != -1, "packer fix command not called");
            assert(tr.stdout.indexOf("writing to file F:\\somedir\\tempdir\\100\\default.windows.template-fixed.json content: { \"some-key\": \"some-value\" }") != -1, "packer validate command not called");
            done();
        });

        it('Should fetch SPN object id if service endpoint does not contain it', (done:MochaDone) => {
            process.env["__spnObjectId_not_exists__"] = "true";
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__spnObjectId_not_exists__"] = "false";

            runValidations(() => {
                assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf("loc_mock_FetchingSPNDetailsRemotely") != -1, "SPN object should be fetched");
                assert(tr.stdout.indexOf("loc_mock_FetchedSPNDetailsRemotely") != -1, "SPN object should be fetched");
            }, tr, done);

        });

        it('Should cleanup temp template folder', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("rmRF F:\\somedir\\tempdir\\100") != -1, "rmRF should be called on temp template folder");
            done();
        });

        it('should fail if builtin template does not exist or copy fails', (done:MochaDone) => {
            process.env["__copy_fails__"] = "true";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__copy_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf("Not found basedir\\DefaultTemplates\\default.windows.template.json") != -1, "error message should be right");
            done();
        });

        it('should fail if custom windows base image template does not exist or copy fails', (done:MochaDone) => {
            process.env["__copy_fails__"] = "true";
            let tp = path.join(__dirname, 'L0WindowsCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__copy_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf("copy failed while copying from basedir\\DefaultTemplates\\custom.windows.template.json") != -1, "error message should be right");
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

        it('should fail if deploy package path cannot be globbed', (done:MochaDone) => {
            process.env["__deploy_package_found__"] = "false";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__deploy_package_found__"] = null;

            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf("##vso[task.complete result=Failed;]loc_mock_TaskParametersConstructorFailed") != -1, "error message should be right");
            done();
        });

        it('should fail if packer fix exits with non zero code', (done:MochaDone) => {
            process.env["__packer_fix_fails__"] = "true";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_fix_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 2, 'should not invoke packer validate and build commands. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("packer fix failed\r\nsome error") != -1, "error message should be right");
            assert(tr.stdout.indexOf("loc_mock_PackerFixFailed") != -1, "error message should be right");
            done();
        });

        it('should fail if packer validate exits with non zero code', (done:MochaDone) => {
            process.env["__packer_validate_fails__"] = "true";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 3, 'should not invoke packer build command. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("packer validate failed\r\nsome error") != -1, "error message should be right");
            assert(tr.stdout.indexOf("loc_mock_PackerValidateFailed") != -1, "error message should be right");
            done();
        });

        it('should fail if packer build exits with non zero code', (done:MochaDone) => {
            process.env["__packer_validate_fails__"] = "false";
            process.env["__packer_build_fails__"] = "true";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_build_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 4, 'all 4 commands should have been invoked. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("packer build failed\r\nsome error") != -1, "error message should be right");
            done();
        });

        it('should fail if packer build exits with non zero code for custom template', (done:MochaDone) => {
            process.env["__packer_build_fails__"] = "true";
            let tp = path.join(__dirname, 'L0CustomTemplate.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_build_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 4, 'all 4 commands should have been invoked. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("packer build failed\r\nsome error") != -1, "error message should be right");
            done();
        });

        it('should fail if output variables cannot be parsed from packer log', (done:MochaDone) => {
            process.env["__packer_build_no_output__"] = "true";
            process.env["__packer_build_fails__"] = "false";
            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_build_no_output__"] = "false";

            assert(tr.failed, 'task should fail if output is not parsed properly');
            assert(tr.invokedToolCount == 4, 'all 4 commands should have been invoked. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]") == -1, "should not try to set output variable");
            assert(tr.stdout.indexOf("##vso[task.issue type=error;]loc_mock_ImageURIOutputVariableNotFound") != -1, "should show proper console message");
            done();
        });

        it('should not fail if output variables cannot be parsed from packer log but output variables has not been set by user', (done:MochaDone) => {
            process.env["__no_output_vars__"] = "true";
            process.env["__packer_build_no_output__"] = "true";

            let tp = path.join(__dirname, 'L0WindowsFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__no_output_vars__"] = "false";
            process.env["__packer_build_no_output__"] = "false";

            assert(tr.succeeded, 'task should not fail if output is not parsed properly');
            assert(tr.invokedToolCount == 4, 'all 4 commands should have been invoked. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]") == -1, "should not try to set output variable");
            done();
        });

        it('parser should parse LF and CR', (done:MochaDone) => {
            process.env["__build_output__"] = "Executed Successfully\nOSDiskUri:   https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\rStorageAccountLocation: SouthIndia\r some random string\n";
            let tp = path.join(__dirname, 'L0Parser.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('copyFiles should not create dest if it exists', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Utilities.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.stdout.indexOf("creating path: F:\\somedir\\tempdir\\100") == -1, "dest should not be created");
            assert(tr.stdout.indexOf("copying .\\DefaultTemplates\\default.windows.template.json to F:\\somedir\\tempdir\\100") != -1, "copy should be done");
            done();
        });

        it('copyFiles should create dest if it does not exist', (done:MochaDone) => {
            process.env["__dest_path_exists__"] = "false";

            let tp = path.join(__dirname, 'L0Utilities.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__dest_path_exists__"] = "true";

            assert(tr.stdout.indexOf("creating path: F:\\somedir\\tempdir\\100") != -1, "dest should be created");
            assert(tr.stdout.indexOf("copying .\\DefaultTemplates\\default.windows.template.json to F:\\somedir\\tempdir\\100") != -1, "copy should be done");
            done();
        });

        it('isGreaterVersion should compare correctly', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Utilities.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.stdout.indexOf("isGreaterVersion scenario 1 pass") != -1, "isGreaterVersion scenario 1 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 2 pass") != -1, "isGreaterVersion scenario 2 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 3 pass") != -1, "isGreaterVersion scenario 3 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 4 pass") != -1, "isGreaterVersion scenario 4 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 5 pass") != -1, "isGreaterVersion scenario 5 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 6 pass") != -1, "isGreaterVersion scenario 6 failed");
            assert(tr.stdout.indexOf("isGreaterVersion scenario 7 pass") != -1, "isGreaterVersion scenario 7 failed");
            done();
        });

        it('Downloads packer for windows agent if packer not exists', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool 4 times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("loc_mock_DownloadingPackerRequired") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("Downloading packer from url: https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_windows_amd64.zip") != -1, "should download from correct url");
            assert(tr.stdout.indexOf("downloading from url https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_windows_amd64.zip to F:\\somedir\\tempdir\\100\\packer.zip") != -1, "should download to correct staging dir");
            assert(tr.stdout.indexOf("extracting from zip F:\\somedir\\tempdir\\100\\packer.zip to F:\\somedir\\tempdir\\100\\packer") != -1, "should extract from and to correct path");
            assert(tr.stdout.indexOf("Packer path to be used by task: F:\\somedir\\tempdir\\100\\packer\\packer.exe") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Downloads packer for windows agent if packer of lower version exists', (done:MochaDone) => {
            process.env["__packer_exists__"] = "true";
            process.env["__lower_version__"] = "true";

            let tp = path.join(__dirname, 'L0WindowsInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_exists__"] = "false";
            process.env["__lower_version__"] = "false";

            assert(tr.invokedToolCount == 5, 'should have invoked tool 5 times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("loc_mock_DownloadingPackerRequired") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("Downloading packer from url: https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_windows_amd64.zip") != -1, "should download from correct url");
            assert(tr.stdout.indexOf("downloading from url https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_windows_amd64.zip to F:\\somedir\\tempdir\\100\\packer.zip") != -1, "should download to correct staging dir");
            assert(tr.stdout.indexOf("extracting from zip F:\\somedir\\tempdir\\100\\packer.zip to F:\\somedir\\tempdir\\100\\packer") != -1, "should extract from and to correct path");
            assert(tr.stdout.indexOf("Packer path to be used by task: F:\\somedir\\tempdir\\100\\packer\\packer.exe") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Should cleanup staging folder on windows agent', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("rmRF F:\\somedir\\tempdir\\100") != -1, "rmRF should be called on temp template folder");
            done();
        });

        it('Downloads packer failure should fail the task', (done:MochaDone) => {
            process.env["__packer_exists__"] = "true";
            process.env["__lower_version__"] = "true";
            process.env["__download_fails__"] = "true";

            let tp = path.join(__dirname, 'L0WindowsInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_exists__"] = "false";
            process.env["__lower_version__"] = "false";
            process.env["__download_fails__"] = "false";

            assert(tr.invokedToolCount == 1, 'should have invoked tool only once. actual: ' + tr.invokedToolCount);
            assert(tr.failed, 'task should fail if download fails');
            assert(tr.stdout.indexOf("##vso[task.issue type=error;]packer download failed!!") != -1, "error message should be right");
            done();
        });

        it('Packer zip extraction failure should fail the task', (done:MochaDone) => {
            process.env["__extract_fails__"] = "true";

            let tp = path.join(__dirname, 'L0WindowsInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__extract_fails__"] = "false";

            assert(tr.invokedToolCount == 0, 'should have invoked tool not even once. actual: ' + tr.invokedToolCount);
            assert(tr.failed, 'task should fail if extraction fails');
            assert(tr.stdout.indexOf("##vso[task.issue type=error;]packer zip extraction failed!!") != -1, "error message should be right");
            done();
        });

        it('Should add additional parameters to builder section in builtin template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsBuiltinTemplateAdditionalParameters.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            runValidations(() => {
                assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
                assert(tr.stdout.indexOf("writing to file F:\\somedir\\tempdir\\100\\default.windows.template-builderUpdated.json content: {\"builders\":[{\"type\":\"amazonaws\",\"ssh_pty\":\"true\"}]}") != -1, "additional parameters should be written to updated template file");
                assert(tr.succeeded, 'task should have succeeded');
            }, tr, done);
        });

    } else {
        it('Runs successfully for linux template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('Runs successfully for linux custom image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0LinuxCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('Creates output variables from packer log for linux', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Creates output variables from packer log for custom linuxbase image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0LinuxCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Should copy builtin template to temp location for linux template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("copying /basedir/DefaultTemplates/default.linux.template.json to /tmp/tempdir/100") != -1, "built-in template should be copied to temp location");

            done();
        });

        it('Should not fetch SPN object for linux VM even if service endpoint does not contain it', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            runValidations(() => {
                assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf("loc_mock_FetchingSPNDetailsRemotely.") == -1, "SPN object should not be fetched");
            }, tr, done);

        });

        it('Should cleanup temp template folder on linux', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("rmRF /tmp/tempdir/100") != -1, "rmRF should be called on temp template folder");
            done();
        });

        it('should fail if custom linux base image template does not exist or copy fails', (done:MochaDone) => {
            process.env["__copy_fails__"] = "true";
            let tp = path.join(__dirname, 'L0LinuxCustomImage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__copy_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf("copy failed while copying from /basedir/DefaultTemplates/custom.linux.template.json") != -1, "error message should be right");
            done();
        });

        it('should fail if packer build exits with non zero code for linux', (done:MochaDone) => {
            process.env["__packer_build_fails__"] = "true";
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_build_fails__"] = "false";

            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 4, 'all 4 commands should have been invoked. actual: ' + tr.invokedToolCount);
            assert(tr.stdout.indexOf("packer build failed\r\nsome error") != -1, "error message should be right");
            done();
        });

        it('Downloads packer for linux agent if packer not exists', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0LinuxInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 3, 'should have invoked tool thrice. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("loc_mock_DownloadingPackerRequired") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("Downloading packer from url: https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_linux_amd64.zip") != -1, "should download from correct url");
            assert(tr.stdout.indexOf("downloading from url https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_linux_amd64.zip to /tmp/tempdir/100/packer.zip") != -1, "should download to correct staging dir");
            assert(tr.stdout.indexOf("extracting from zip /tmp/tempdir/100/packer.zip to /tmp/tempdir/100/packer") != -1, "should extract from and to correct path");
            assert(tr.stdout.indexOf("Packer path to be used by task: /tmp/tempdir/100/packer/packer") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Downloads packer for linux agent if packer of lower version exists', (done:MochaDone) => {
            process.env["__packer_exists__"] = "true";
            process.env["__lower_version__"] = "true";

            let tp = path.join(__dirname, 'L0LinuxInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["__packer_exists__"] = "false";
            process.env["__lower_version__"] = "false";

            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("loc_mock_DownloadingPackerRequired") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("Downloading packer from url: https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_linux_amd64.zip") != -1, "should download from correct url");
            assert(tr.stdout.indexOf("downloading from url https://releases.hashicorp.com/packer/0.12.3/packer_0.12.3_linux_amd64.zip to /tmp/tempdir/100/packer.zip") != -1, "should download to correct staging dir");
            assert(tr.stdout.indexOf("extracting from zip /tmp/tempdir/100/packer.zip to /tmp/tempdir/100/packer") != -1, "should extract from and to correct path");
            assert(tr.stdout.indexOf("Packer path to be used by task: /tmp/tempdir/100/packer/packer") != -1, "should show message that packer will be downloaded");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=imageUri;issecret=false;]https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd") != -1, "image uri output variable not set");
            done();
        });

        it('Should cleanup staging folder on linux agent', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0LinuxInstallPacker.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("rmRF /tmp/tempdir/100") != -1, "rmRF should be called on temp template folder");
            done();
        });

        it('Should add additional parameters to builder section in builtin template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0LinuxBuiltinTemplateAdditionalParameters.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.stdout.indexOf("writing to file /tmp/tempdir/100/default.linux.template-builderUpdated.json content: {\"builders\":[{\"type\":\"amazonaws\",\"ssh_pty\":\"true\"}]}") != -1, "additional parameters should be written to updated template file");
            assert(tr.succeeded, 'task should have succeeded');
            done();
        });
    }
});
