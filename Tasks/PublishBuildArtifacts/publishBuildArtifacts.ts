/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vso-task-lib.d.ts" />

import fs = require('fs');
import path = require('path');
import Q = require('q');
var tl = require("vso-task-lib");

// content is a folder contain artifacts needs to publish.
var artifactContents: string = tl.getPathInput('ArtifactContents');
var artifactName: string = tl.getInput('ArtifactName');
var artifactType: string = tl.getInput('ArtifactType');
// targetPath is used for file shares
var targetPath: string = tl.getInput('TargetPath');

if (!artifactName) {
    // nothing to do
    tl.warning('Artifact name is not specified.');
}
else if (!artifactType) {
    // nothing to do
    tl.warning('Artifact type is not specified.');
}
else {
    artifactType = artifactType.toLowerCase();
    
    try {
        var data = {
            artifacttype: artifactType,
            artifactname: artifactName
        };
       
        // upload or copy
        if (artifactType === "container") {
            data["containerfolder"] = artifactName;
            
            // add localpath to ##vso command's properties for back compat of old Xplat agent
            data["localpath"] = artifactContents;
            tl.command("artifact.upload", data, artifactContents);
        }
        else if (artifactType === "filepath") {
            var artifactPath: string = path.join(targetPath, artifactName);
            tl.mkdirP(artifactPath);
            tl.cp("-Rf", path.join(artifactContents, "*"), artifactPath);
            
            // add artifactlocation to ##vso command's properties for back compat of old Xplat agent
            data["artifactlocation"] = targetPath;
            tl.command("artifact.associate", data, targetPath);
        }
    }
    catch (err) {
        tl.error(err);
        tl.exit(1);
    }
}
