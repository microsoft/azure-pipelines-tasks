var fs = require('fs');
var path = require('path');
var util = require('./ci-util');

// initialize _package
util.initializePackagePath();

// mkdir _package/milestone-layout
fs.mkdirSync(util.milestoneLayoutPath);

// mark the layout with a version number.
// servicing supports both this new format and the legacy layout format as well.
fs.writeFileSync(path.join(util.milestoneLayoutPath, 'layout-version.txt'), '2');

// extract the artifact
var artifactZipPath = path.join(process.env.SYSTEM_ARTIFACTSDIRECTORY, "package", "tasks.zip");
var artifactPath = path.join(util.packagePath, "package");
util.expandTasks(artifactZipPath, artifactPath);

// link the artifact
fs.readdirSync(artifactPath).forEach(function (itemName) {
    var itemSourcePath = path.join(artifactPath, itemName);
    if (!fs.lstatSync(itemSourcePath).isDirectory()) {
        throw new Error(`Expected item to be a directory: ${itemSourcePath}`);
    }

    var itemDestPath = path.join(util.milestoneLayoutPath, itemName);
    fs.symlinkSync(itemSourcePath, itemDestPath, 'junction');
});

// create the nuspec file
var nuspecContent =
    `<?xml version="1.0"?>`
    + `\n<package>`
    + `\n  <metadata>`
    + `\n    <id>vsts-tasks-milestone</id>`
    + `\n    <version>${process.env.MILESTONE_VERSION}</version>`
    + `\n    <authors>vsts</authors>`
    + `\n    <owners>vsts</owners>`
    + `\n    <requireLicenseAcceptance>false</requireLicenseAcceptance>`
    + `\n    <description>vsts-tasks</description>`
    + `\n    <releaseNotes>vsts-tasks</releaseNotes>`
    + `\n    <copyright>Copyright 2017</copyright>`
    + `\n    <tags />`
    + `\n    <dependencies />`
    + `\n  </metadata>`
    + `\n</package>`;
fs.writeFileSync(util.milestoneNuspecPath, nuspecContent);

// mkdir _package/milestone-pack-source
fs.mkdirSync(util.milestonePackSourcePath);

// link the milestone layout
fs.symlinkSync(util.milestoneLayoutPath, util.milestonePackSourceContentsPath, 'junction');

if (process.env.PUBLISH_MILESTONE) {
    // pack the milestone
    process.chdir(util.packagePath);
    util.run(`nuget pack "${util.milestoneNuspecPath}" -BasePath "${util.milestonePackSourcePath}" -NoDefaultExcludes`, /*inheritStreams:*/true);
}
