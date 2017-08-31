var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('./ci-util');

// mkdir _package/aggregate-layout
fs.mkdirSync(util.aggregateLayoutPath);

// mark the layout with a version number.
// servicing supports both this new format and the legacy layout format as well.
fs.writeFileSync(path.join(util.aggregateLayoutPath, 'layout-version.txt'), '2');

// get branch/commit info
var refs = util.getRefs();

// track task GUID + major version -> destination path
// task directory names can change between different release branches
var taskDestMap = {};

// link the tasks from the non-aggregate layout into the aggregate layout
util.linkAggregateLayoutContent(util.milestoneLayoutPath, util.aggregateLayoutPath, /*release:*/'', /*commit:*/refs.head.commit, taskDestMap);

// link the tasks from previous releases into the aggregate layout
Object.keys(refs.releases)
    .sort()
    .reverse()
    .forEach(function (release) {
        // skip the current release (already covered by current build)
        if (release == refs.head.release) {
            return;
        }

        var commit = refs.releases[release].commit;
        var releaseLayout = path.join(util.restorePath, `vsts-tasks-milestone.1.0.0-m${release}-${commit}`, 'contents');
        util.linkAggregateLayoutContent(releaseLayout, util.aggregateLayoutPath, /*release:*/release, /*commit:*/commit, taskDestMap);
    });

// validate task uniqueness within the layout based on task GUID + major version
var majorVersions = {};
fs.readdirSync(util.aggregateLayoutPath) // walk each item in the aggregate layout
    .forEach(function (itemName) {
        var itemPath = path.join(util.aggregateLayoutPath, itemName);
        if (!fs.statSync(itemPath).isDirectory()) { // skip files
            return;
        }

        // load the task.json
        var taskPath = path.join(itemPath, 'task.json');
        var task = JSON.parse(fs.readFileSync(taskPath));
        if (typeof task.version.Major != 'number') {
            fail(`Expected task.version.Major/Minor/Patch to be a number (${taskPath})`);
        }

        util.assert(task.id, `task.id (${taskPath})`);
        if (typeof task.id != 'string') {
            fail(`Expected id to be a string (${taskPath})`);
        }

        // validate GUID + Major version is unique
        var key = task.id + task.version.Major;
        if (majorVersions[key]) {
            fail(`Tasks GUID + Major version must be unique within the aggregate layout. Task 1: ${majorVersions[key]}; task 2: ${taskPath}`);
        }

        majorVersions[key] = taskPath;
    });

// create the aggregate tasks zip: _package/aggregate-pack-source/contents/Microsoft.TeamFoundation.Build.Tasks.zip
console.log();
console.log('> Zipping aggregate tasks layout');
fs.mkdirSync(util.aggregatePackSourcePath);
fs.mkdirSync(util.aggregatePackSourceContentsPath);
util.compressTasks(util.aggregateLayoutPath, util.aggregatePackSourceContentsZipPath);

// create the nuspec file
console.log();
console.log('> Generating .nuspec file');
var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
contents += '   <metadata>' + os.EOL;
contents += '      <id>' + util.aggregatePackageName + '</id>' + os.EOL;
contents += '      <version>' + process.env.AGGREGATE_VERSION + '</version>' + os.EOL;
contents += '      <authors>bigbldt</authors>' + os.EOL;
contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
contents += '      <description>For VSS internal use only</description>' + os.EOL;
contents += '      <tags>VSSInternal</tags>' + os.EOL;
contents += '   </metadata>' + os.EOL;
contents += '</package>' + os.EOL;
fs.writeFileSync(util.aggregateNuspecPath, contents);
