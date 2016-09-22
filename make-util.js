
require('shelljs');
var admZip = require('adm-zip');
var check = require('validator');
var fs = require('fs');
var minimatch = require('minimatch');
var os = require('os');
var path = require('path');
var process = require('process');
var ncp = require('child_process');
var syncRequest = require('sync-request');

set('-e');

var downloadPath = path.join(__dirname, '_download');
var testPath = path.join(__dirname, '_test');

var makeOptions = require('./make-options.json');

// list of .NET culture names
var cultureNames = [ 'cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr', 'zh-Hans', 'zh-Hant' ];

function assert(value, name) {
    if (!value) {
        throw new Error('"' + name + '" cannot be null or empty.');
    }
}
exports.assert = assert;

var banner = function (message, noBracket) {
    console.log();
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log(message);
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log();
}
exports.banner = banner;

var rp = function (relPath) {
    return path.join(pwd() + '', relPath);
}
exports.rp = rp;

var fail = function (message) {
    console.error('ERROR: ' + message);
    process.exit(1);
}
exports.fail = fail;

var ensureExists = function (checkPath) {
    var exists = test('-d', checkPath) || test('-f', checkPath);

    if (!exists) {
        fail(checkPath + ' does not exist');
    }
}
exports.ensureExists = ensureExists;

var pathExists = function (checkPath) {
    return test('-d', checkPath) || test('-f', checkPath);
}
exports.pathExists = pathExists;

var buildNodeTask = function (taskPath, outDir) {
    var originalDir = pwd();
    cd(taskPath);
    if (test('-f', rp('package.json'))) {
        run('npm install');
    }
    run('tsc --outDir ' + outDir);
    cd(originalDir);
}
exports.buildNodeTask = buildNodeTask;

var copyTaskResources = function (taskMake, srcPath, destPath) {
    console.log();
    console.log('> copying task resources');
    assert(taskMake, 'taskMake');
    assert(srcPath, 'srcPath');
    assert(destPath, 'destPath');

    // copy the globally defined set of default task resources
    var toCopy = makeOptions['taskResources'];
    toCopy.forEach(function (item) {
        matchCopy(item, srcPath, destPath);
    });

    // copy the locally defined set of resources
    if (taskMake.hasOwnProperty('cp')) {
        copyGroups(taskMake.cp, srcPath, destPath);
    }
}
exports.copyTaskResources = copyTaskResources;

var matchCopy = function (pattern, sourceRoot, destRoot, options) {
    assert(pattern, 'pattern');
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');

    // merge specified options with defaults
    mergedOptions = { matchBase: true };
    Object.keys(options || {}).forEach(function (key) {
        mergedOptions[key] = options[key];
    });

    // normalize first, so we can substring later
    sourceRoot = path.resolve(sourceRoot);
    destRoot = path.resolve(destRoot);

    // let's add logging and tracing
    //console.log(`copying ${pattern} from ${sourceRoot.substring(__dirname.length + 1)} to ${destRoot.substring(__dirname.length + 1)}`);
    console.log(`copying ${pattern}`);
    
    minimatch.match(find(sourceRoot), pattern, mergedOptions)
        .forEach(function (item) {
            // determine the relative item path
            var relative = item.substring(sourceRoot.length + 1);
            assert(relative, 'relative'); // root folder matching is not supported

            // create the dest dir
            var dest = path.dirname(path.join(destRoot, relative));
            mkdir('-p', dest);

            // copy
            cp('-R', item, dest + '/');
        });
}
exports.matchCopy = matchCopy;

exports.run = function (cl, echo) {
    console.log();
    console.log('> ' + cl);
    echo = echo || process.env['TASK_BUILD_VERBOSE'];
    var options = {
        stdio: echo ? 'inherit' : 'pipe'
    };
    var rc = 0;
    try {
        ncp.execSync(cl, options);
    }
    catch (err) {
        if (!echo) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        exit(1);
    }
}
var run = exports.run;

var ensureTool = function (name, versionArgs) {
    console.log(name + ' tool:');
    var toolPath = which(name);
    if (!toolPath) {
        fail(name + ' not found.  might need to run npm install');
    }

    exec(name + ' ' + versionArgs);
    console.log(toolPath + '');
}
exports.ensureTool = ensureTool;

var downloadFile = function (url) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'file', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        console.log('Downloading file: ' + url);

        // delete any previous partial attempt
        if (test('-f', targetPath)) {
            rm('-f', targetPath);
        }

        // download the file
        mkdir('-p', path.join(downloadPath, 'file'));
        var result = syncRequest('GET', url);
        fs.writeFileSync(targetPath, result.getBody());

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}
exports.downloadFile = downloadFile;

var downloadArchive = function (url, omitExtensionCheck) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    if (!omitExtensionCheck && !url.match(/\.zip$/)) {
        throw new Error('Expected .zip');
    }

    // skip if already downloaded and extracted
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        // download the archive
        var archivePath = downloadFile(url);
        console.log('Extracting archive: ' + url);

        // delete any previously attempted extraction directory
        if (test('-d', targetPath)) {
            rm('-rf', targetPath);
        }

        // extract
        mkdir('-p', targetPath);
        var zip = new admZip(archivePath);
        zip.extractAllTo(targetPath);

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}
exports.downloadArchive = downloadArchive;

var copyGroup = function (group, sourceRoot, destRoot) {
    // example structure to copy a single file:
    // {
    //   "source": "foo.dll"
    // }
    //
    // example structure to copy an array of files/folders to a relative directory:
    // {
    //   "source": [
    //     "foo.dll",
    //     "bar",
    //   ]
    //   "dest": "baz/",
    //   "options": "-R"
    // }
    //
    // example to multiply the copy by .NET culture names supported by TFS:
    // {
    //   "source": "<CULTURE_NAME>/foo.dll"
    //   "dest": "<CULTURE_NAME>/"
    // }
    //

    // validate parameters
    assert(group, 'group');
    assert(group.source, 'group.source');
    if (typeof group.source == 'object') {
        assert(group.source.length, 'group.source.length');
        group.source.forEach(function (s) {
            assert(s, 'group.source[i]');
        });
    }

    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');

    // multiply by culture name (recursive call to self)
    if (group.dest && group.dest.indexOf('<CULTURE_NAME>') >= 0) {
        cultureNames.forEach(function (cultureName) {
            // culture names do not contain any JSON-special characters, so this is OK (albeit a hack)
            var localizedGroupJson = JSON.stringify(group).replace(/<CULTURE_NAME>/g, cultureName);
            copyGroup(JSON.parse(localizedGroupJson), sourceRoot, destRoot);
        });

        return;
    }

    // build the source array
    var source = typeof group.source == 'string' ? [ group.source ] : group.source;
    source = source.map(function (val) { // root the paths
        return path.join(sourceRoot, val);
    });

    // create the destination directory
    var dest = group.dest ? path.join(destRoot, group.dest) : destRoot + '/';
    mkdir('-p', dest);

    // copy the files
    if (group.hasOwnProperty('options') && group.options) {
        cp(group.options, source, dest);
    }
    else {
        cp(source, dest);
    }
}

var copyGroups = function (groups, sourceRoot, destRoot) {
    assert(groups, 'groups');
    assert(groups.length, 'groups.length');
    groups.forEach(function (group) {
        copyGroup(group, sourceRoot, destRoot);
    })
}
exports.copyGroups = copyGroups;

var addPath = function (directory) {
    var separator;
    if (os.platform() == 'win32') {
        separator = ';';
    }
    else {
        separator = ':';
    }

    var existing = process.env['PATH'];
    if (existing) {
        process.env['PATH'] = directory + separator + existing;
    }
    else {
        process.env['PATH'] = directory;
    }
}
exports.addPath = addPath;

var getExternals = function (externals, destRoot) {
    assert(externals, 'externals');
    assert(destRoot, 'destRoot');

    // .zip files
    if (externals.hasOwnProperty('archivePackages')) {
        var archivePackages = externals.archivePackages;
        archivePackages.forEach(function (archive) {
            assert(archive.url, 'archive.url');
            assert(archive.dest, 'archive.dest');

            // download and extract the archive package
            var archiveSource = downloadArchive(archive.url);

            // copy the files
            var archiveDest = path.join(destRoot, archive.dest);
            mkdir('-p', archiveDest);
            cp('-R', path.join(archiveSource, '*'), archiveDest)
        });
    }

    // external NuGet V2 packages
    if (externals.hasOwnProperty('nugetv2')) {
        var nugetPackages = externals.nugetv2;
        nugetPackages.forEach(function (package) {
            // validate the structure of the data
            assert(package.name, 'package.name');
            assert(package.version, 'package.version');
            assert(package.repository, 'package.repository');
            assert(package.cp, 'package.cp');
            assert(package.cp, 'package.cp.length');

            // download and extract the NuGet V2 package
            var url = package.repository.replace(/\/$/, '') + '/package/' + package.name + '/' + package.version;
            var packageSource = downloadArchive(url, /*omitExtensionCheck*/true);

            // copy specific files
            copyGroups(package.cp, packageSource, destRoot);
        });
    }
}
exports.getExternals = getExternals;

//------------------------------------------------------------------------------
// task.json functions
//------------------------------------------------------------------------------

var createResjson = function (task, taskPath) {
    var resources = {};
    if (task.hasOwnProperty('friendlyName')) {
        resources['loc.friendlyName'] = task.friendlyName;
    }

    if (task.hasOwnProperty('helpMarkDown')) {
        resources['loc.helpMarkDown'] = task.helpMarkDown;
    }

    if (task.hasOwnProperty('description')) {
        resources['loc.description'] = task.description;
    }

    if (task.hasOwnProperty('instanceNameFormat')) {
        resources['loc.instanceNameFormat'] = task.instanceNameFormat;
    }

    if (task.hasOwnProperty('groups')) {
        task.groups.forEach(function (group) {
            if (group.hasOwnProperty('name')) {
                resources['loc.group.displayName.' + group.name] = group.displayName;
            }
        });
    }

    if (task.hasOwnProperty('inputs')) {
        task.inputs.forEach(function (input) {
            if (input.hasOwnProperty('name')) {
                resources['loc.input.label.' + input.name] = input.label;

                if (input.hasOwnProperty('helpMarkDown') && input.helpMarkDown) {
                    resources['loc.input.help.' + input.name] = input.helpMarkDown;
                }
            }
        });
    }

    if (task.hasOwnProperty('messages')) {
        Object.keys(task.messages).forEach(function (key) {
            resources['loc.messages.' + key] = task.messages[key];
        });
    }

    var resjsonPath = path.join(taskPath, 'Strings', 'resources.resjson', 'en-US', 'resources.resjson');
    mkdir('-p', path.dirname(resjsonPath));
    fs.writeFileSync(resjsonPath, JSON.stringify(resources, null, 2));
};
exports.createResjson = createResjson;

var createTaskLocJson = function (taskPath) {
    var taskJsonPath = path.join(taskPath, 'task.json');
    var taskLoc = JSON.parse(fs.readFileSync(taskJsonPath));
    taskLoc.friendlyName = 'ms-resource:loc.friendlyName';
    taskLoc.helpMarkDown = 'ms-resource:loc.helpMarkDown';
    taskLoc.description = 'ms-resource:loc.description';
    taskLoc.instanceNameFormat = 'ms-resource:loc.instanceNameFormat';
    if (taskLoc.hasOwnProperty('groups')) {
        taskLoc.groups.forEach(function (group) {
            if (group.hasOwnProperty('name')) {
                group.displayName = 'ms-resource:loc.group.displayName.' + group.name;
            }
        });
    }

    if (taskLoc.hasOwnProperty('inputs')) {
        taskLoc.inputs.forEach(function (input) {
            if (input.hasOwnProperty('name')) {
                input.label = 'ms-resource:loc.input.label.' + input.name;

                if (input.hasOwnProperty('helpMarkDown') && input.helpMarkDown) {
                    input.helpMarkDown = 'ms-resource:loc.input.help.' + input.name;
                }
            }
        });
    }

    if (taskLoc.hasOwnProperty('messages')) {
        Object.keys(taskLoc.messages).forEach(function (key) {
            taskLoc.messages[key] = 'ms-resource:loc.messages.' + key;
        });
    }

    fs.writeFileSync(path.join(taskPath, 'task.loc.json'), JSON.stringify(taskLoc, null, 2));
};
exports.createTaskLocJson = createTaskLocJson;

// Validates the structure of a task.json file.
var validateTask = function (task) {
    if (!task.id || !check.isUUID(task.id)) {
        fail('id is a required guid');
    };

    if (!task.name || !check.isAlphanumeric(task.name)) {
        fail('name is a required alphanumeric string');
    }

    if (!task.friendlyName || !check.isLength(task.friendlyName, 1, 40)) {
        fail('friendlyName is a required string <= 40 chars');
    }

    if (!task.instanceNameFormat) {
        fail('instanceNameFormat is required');
    }
};
exports.validateTask = validateTask;
