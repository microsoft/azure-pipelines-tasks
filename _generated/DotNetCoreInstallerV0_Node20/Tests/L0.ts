'use strict';

import assert = require('assert');
import tl = require('azure-pipelines-task-lib');
import ttm = require('azure-pipelines-task-lib/mock-test');
import path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
    try {
        validator();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        throw error;
    }
}

describe('DotNetCoreInstaller', function() {
    this.timeout(30000);
    before(() => {
        process.env['SYSTEM_DEBUG'] = 'true';
    });
    after(() => {
    });

    if(tl.getPlatform() == tl.Platform.Windows) {
        process.env["AGENT_TEMPDIRECTORY"] =  process.cwd();
        it("[windows]should succeed if sdk installed successfully", async () => {
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall sdk 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncs and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") > -1, "should install fresh if cache miss");
                assert(tr.stdout.indexOf("Downloading tool from https://primary-url") > -1, "should download from correct url");
                assert(tr.stdout.indexOf("Extracting zip archive from "+process.env["AGENT_TEMPDIRECTORY"]+"\\someArchive.zip") > -1, "Should extract downloaded archive corectly");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"\\someDir for tool dncs version 1.0.4") > -1, "should cache correctly");
                assert(tr.stdout.indexOf("loc_mock_SuccessfullyInstalled sdk 1.0.4") > -1, "should print installed tool info");
                assert(tr.stdout.indexOf("prepending path: C:\\agent\\_tools\\cacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });

        it("[windows]should succeed if runtime installed successfully", async () => {
            process.env["__package_type__"] = "runtime";
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__package_type__"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall runtime 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncr and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") > -1, "should install fresh if cache miss");
                assert(tr.stdout.indexOf("Downloading tool from https://primary-runtime-url") > -1, "should download from correct url");
                assert(tr.stdout.indexOf("Extracting zip archive from "+ process.env["AGENT_TEMPDIRECTORY"]+"\\someArchive.zip") > -1, "Should extract downloaded archive corectly");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"\\someDir for tool dncr version 1.0.4") > -1, "should cache correctly");
                assert(tr.stdout.indexOf("loc_mock_SuccessfullyInstalled runtime 1.0.4") > -1, "should print installed tool info");
                assert(tr.stdout.indexOf("prepending path: C:\\agent\\_tools\\cacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });

        it("[windows]should not install again if cache hit", async () => {
            process.env["__cache_hit__"] = "true";
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__cache_hit__"];
            
            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall sdk 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncs and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") == -1, "should not install fresh");
                assert(tr.stdout.indexOf("loc_mock_GettingDownloadUrls") == -1, "should not download");
                assert(tr.stdout.indexOf("loc_mock_UsingCachedTool") > -1, "should print that cached dir is being used");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"\\someDir for tool dncs version 1.0.4") == -1, "should not update cache again");
                assert(tr.stdout.indexOf("prepending path: C:\\agent\\_tools\\oldCacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });


        it("[windows]should download using legacy url if primary url does not work", async () => {
            process.env["__primary_url_failed__"] = "true";
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__primary_url_failed__"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("404 not found https://primary-url") > -1, "should print primary url failure error")
                assert(tr.stdout.indexOf("Downloading tool from https://legacy-url") > -1, "should download from legacy url");
            }, tr);
        });

        it("[windows]should fail if explicit version is not used", async () => {
            process.env["__implicit_version__"] = "true";
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__implicit_version__"];

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("loc_mock_ImplicitVersionNotSupported") > -1, "should print error message");
            }, tr);
        });

        it("[windows]should fail if getting download script fails", async () => {
            process.env["__get_dlurls_failed__"] = "true";
            let tp = path.join(__dirname, "InstallWindows.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__get_dlurls_failed__"];

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("loc_mock_getDownloadUrlsFailed install-script failed to get donwload urls") > -1, "should print error message");
                assert(tr.stdout.indexOf("loc_mock_DownloadingPrimaryUrl") == -1, "should not proceed with downloading");
            }, tr);
        });
    } else {
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
        it("[nix]should succeed if sdk installed successfully", async () => {
            let tp = path.join(__dirname, "InstallNix.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall sdk 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncs and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") > -1, "should install fresh if cache miss");
                assert(tr.stdout.indexOf("Changing attribute for file /somedir/currdir/externals/get-os-distro.sh to 755") > -1, "should set executable attribute for install script");
                assert(tr.stdout.indexOf("Downloading tool from https://primary-url") > -1, "should download from correct url");
                assert(tr.stdout.indexOf("Extracting tar archive from "+process.env["AGENT_TEMPDIRECTORY"]+"/someArchive.tar") > -1, "Should extract downloaded archive corectly");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"/someDir for tool dncs version 1.0.4") > -1, "should cache correctly");
                assert(tr.stdout.indexOf("loc_mock_SuccessfullyInstalled sdk 1.0.4") > -1, "should print installed tool info");
                assert(tr.stdout.indexOf("prepending path: /agent/_tools/cacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });

        it("[nix]should succeed if runtime installed successfully", async () => {
            process.env["__package_type__"] = "runtime";
            let tp = path.join(__dirname, "InstallNix.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__package_type__"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall runtime 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncr and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") > -1, "should install fresh if cache miss");
                assert(tr.stdout.indexOf("Downloading tool from https://primary-runtime-url") > -1, "should download from correct url");
                assert(tr.stdout.indexOf("Extracting tar archive from "+process.env["AGENT_TEMPDIRECTORY"]+"/someArchive.tar") > -1, "Should extract downloaded archive corectly");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"/someDir for tool dncr version 1.0.4") > -1, "should cache correctly");
                assert(tr.stdout.indexOf("loc_mock_SuccessfullyInstalled runtime 1.0.4") > -1, "should print installed tool info");
                assert(tr.stdout.indexOf("prepending path: /agent/_tools/cacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });

        it("[nix]should not install again if cache hit", async () => {
            process.env["__cache_hit__"] = "true";
            let tp = path.join(__dirname, "InstallNix.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__cache_hit__"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("loc_mock_ToolToInstall sdk 1.0.4") > -1, "should print to-be-installed info");
                assert(tr.stdout.indexOf("Checking local tool for dncs and version 1.0.4") > -1, "should check for local cached tool");
                assert(tr.stdout.indexOf("loc_mock_InstallingAfresh") == -1, "should not install fresh");
                assert(tr.stdout.indexOf("loc_mock_GettingDownloadUrls") == -1, "should not download");
                assert(tr.stdout.indexOf("loc_mock_UsingCachedTool") > -1, "should print that cached dir is being used");
                assert(tr.stdout.indexOf("Caching dir "+process.env["AGENT_TEMPDIRECTORY"]+"someDir for tool dncs version 1.0.4") == -1, "should not update cache again");
                assert(tr.stdout.indexOf("prepending path: /agent/_tools/oldCacheDir") > -1, "should pre-prend to PATH");
            }, tr);
        });

        it("[nix]Should download using DLC url if primary url does not work", async () => {
            process.env["__primary_url_failed__"] = "true";
            let tp = path.join(__dirname, "InstallNix.js");
            let tr = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            delete process.env["__primary_url_failed__"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("404 not found https://primary-url") > -1, "should print primary url failure error")
                assert(tr.stdout.indexOf("Downloading tool from https://legacy-url") > -1, "should download from legacy url");
            }, tr);
        });
    }
});
