/*
  Copyright (c) Microsoft. All rights reserved.
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
var tl = require('vsts-task-lib/task');
var tr = require('vsts-task-lib/toolrunner');
var path = require('path');
var Q = require('q');
var xcutils = require('./xcode-task-utils.js');
//--------------------------------------------------------
// Tooling
//--------------------------------------------------------
tl.setEnvVar('DEVELOPER_DIR', tl.getInput('xcodeDeveloperDir', false));
var usexc = (tl.getInput('useXctool', false) == "true");
var tool = usexc ? tl.which('xctool', true) : tl.which('xcodebuild', true);
tl.debug('Tool selected: ' + tool);
//--------------------------------------------------------
// Paths
//--------------------------------------------------------
tl.cd(tl.getInput('cwd'));
var outPath = path.resolve(process.cwd(), tl.getInput('outputPattern', true));
tl.mkdirP(outPath);
//--------------------------------------------------------
// Xcode args
//--------------------------------------------------------
var ws = null;
var wsPath = tl.getPathInput('xcWorkspacePath', false, false);
if (tl.filePathSupplied(wsPath)) {
    ws = tl.globFirst(wsPath);
    if (!ws) {
        tl.setResult(tl.TaskResult.Failed, 'Workspace specified but it does not exist or is not a directory');
    }
}
var sdk = tl.getInput('sdk', true);
var cfg = tl.getInput('configuration', true);
var scheme = tl.getInput('scheme', false);
var xcrpt = tl.getInput('xctoolReporter', false);
var actions = tl.getDelimitedInput('actions', ' ', true);
var out = path.resolve(process.cwd(), tl.getInput('outputPattern', true));
var pkgapp = tl.getBoolInput('packageApp', true);
//--------------------------------------------------------
// Exec Tools
//--------------------------------------------------------
// --- Xcode Version ---
var xcv = new tr.ToolRunner(tool);
xcv.arg('-version');
xcv.exec(null)
    .then(function (code) {
    tl.exitOnCodeIf(code, code != 0);
    // --- XcodeBuild ---
    var xcb = new tr.ToolRunner(tool);
    xcb.arg(['-sdk', sdk]);
    xcb.arg(['-configuration', cfg]);
    xcb.argIf(ws, ['-workspace', ws]);
    xcb.argIf(scheme, ['-scheme', scheme]);
    xcb.argIf(usexc && xcrpt, ['-reporter', 'plain', '-reporter', xcrpt]);
    xcb.arg(actions);
    xcb.arg('DSTROOT=' + path.join(out, 'build.dst'));
    xcb.arg('OBJROOT=' + path.join(out, 'build.obj'));
    xcb.arg('SYMROOT=' + path.join(out, 'build.sym'));
    xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(out, 'build.pch'));
    return xcb.exec(null);
})
    .then(function (code) {
    // --- PackageApps ---
    if (pkgapp && sdk != "iphonesimulator") {
        console.log('Packaging apps');
        var xcrunPath = tl.which('xcrun', true);
        var fl = tl.glob(path.join(out, 'build.sym', '**', '*.app'));
        for (var i = 0; i < fl.length; i++) {
            var app = fl[i];
            tl.debug('Packaging ' + app);
            var ipa = app.substring(0, app.length - 3) + "ipa";
            var xcr = new tr.ToolRunner(xcrunPath);
            xcr.arg(['-sdk', sdk, 'PackageApplication', '-v', app, '-o', ipa]);
            var ret = xcr.execSync(null);
            tl.exitOnCodeIf(ret.code, ret.code != 0);
        }
    }
    else {
        return Q(0);
    }
})
    .fail(function (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
});
/*
function processInputs() {

    
    return iosIdentity().then(iosProfile);
}

function iosIdentity() {
    
    var input = {
        cwd: cwd,
        unlockDefaultKeychain: (tl.getInput('unlockDefaultKeychain', false)=="true"),
        defaultKeychainPassword: tl.getInput('defaultKeychainPassword',false),
        p12: tl.getPathInput('p12', false, false),
        p12pwd: tl.getInput('p12pwd', false),
        iosSigningIdentity: tl.getInput('iosSigningIdentity', false)
    }
        
    return xcutils.determineIdentity(input)
        .then(function(result) {
            if(result.identity) {
                // TODO: Add CODE_SIGN_IDENTITY[iphoneos*]?
                xcb.arg('CODE_SIGN_IDENTITY="' + result.identity + '"');
            } else {
                tl.debug('No explicit signing identity specified in task.')
            }
            if(result.keychain) {
                xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain="' + result.keychain + '"');
            }
            deleteKeychain = result.deleteCommand;
        });
}

function iosProfile() {
    var input = {
        cwd: cwd,
        provProfileUuid:tl.getInput('provProfileUuid', false),
        provProfilePath:tl.getPathInput('provProfile', false),
        removeProfile:(tl.getInput('removeProfile', false)=="true")
    }
    
    return xcutils.determineProfile(input)
        .then(function(result) {
            if(result.uuid) {
                xcb.arg('PROVISIONING_PROFILE=' + result.uuid);
            }
            deleteProvProfile = result.deleteCommand;
        });
}

*/
