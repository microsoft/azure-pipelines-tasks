var admZip = require('adm-zip');
var check = require('validator');
var fs = require('fs');
var makeOptions = require('./make-options.json');
var minimatch = require('minimatch');
var ncp = require('child_process');
var os = require('os');
var path = require('path');
var process = require('process');
var semver = require('semver');
var shell = require('shelljs');
var syncRequest = require('sync-request');

// global paths
var downloadPath = path.join(__dirname, '_download');

// list of .NET culture names
var cultureNames = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr', 'zh-Hans', 'zh-Hant'];

//------------------------------------------------------------------------------
// shell functions
//------------------------------------------------------------------------------
var shellAssert = function () {
    var errMsg = shell.error();
    if (errMsg) {
        throw new Error(errMsg);
    }
}

var cd = function (dir) {
    var cwd = process.cwd();
    if (cwd != dir) {
        console.log('');
        console.log(`> cd ${path.relative(cwd, dir)}`);
        shell.cd(dir);
        shellAssert();
    }
}
exports.cd = cd;

var cp = function (options, source, dest) {
    if (dest) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(options, source);
    }

    shellAssert();
}
exports.cp = cp;

var mkdir = function (options, target) {
    if (target) {
        shell.mkdir(options, target);
    }
    else {
        shell.mkdir(options);
    }

    shellAssert();
}
exports.mkdir = mkdir;

var rm = function (options, target) {
    if (target) {
        shell.rm(options, target);
    }
    else {
        shell.rm(options);
    }

    shellAssert();
}
exports.rm = rm;

var test = function (options, p) {
    var result = shell.test(options, p);
    shellAssert();
    return result;
}
exports.test = test;
//------------------------------------------------------------------------------

var assert = function (value, name) {
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
    assert(checkPath, 'checkPath');
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

/**
 * Given a module path, gets the info used for generating a pack file
 */
var getCommonPackInfo = function (modOutDir) {
    // assert the module has a package.json
    var packageJsonPath = path.join(modOutDir, 'package.json');
    if (!test('-f', packageJsonPath)) {
        fail(`Common module package.json does not exist: '${packageJsonPath}'`);
    }

    // assert the package name and version
    var packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
    if (!packageJson || !packageJson.name || !packageJson.version) {
        fail(`The common module's package.json must define a name and version: ${packageJsonPath}`);
    }

    var packFileName = `${packageJson.name}-${packageJson.version}.tgz`;
    return {
        "packageName": packageJson.name,
        "packFilePath": path.join(path.dirname(modOutDir), packFileName)
    };
}
exports.getCommonPackInfo = getCommonPackInfo;

var buildNodeTask = function (taskPath, outDir) {
    var originalDir = pwd();
    cd(taskPath);
    var packageJsonPath = rp('package.json');
    if (test('-f', packageJsonPath)) {
        // verify no dev dependencies
        var packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
        if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length != 0) {
            fail('The package.json should not contain dev dependencies. Move the dev dependencies into a package.json file under the Tests sub-folder. Offending package.json: ' + packageJsonPath);
        }

        run('npm install');
    }

    if (test('-f', rp(path.join('Tests', 'package.json')))) {
        cd(rp('Tests'));
        run('npm install');
        cd(taskPath);
    }

    run('tsc --outDir ' + outDir + ' --rootDir ' + taskPath);
    cd(originalDir);
}
exports.buildNodeTask = buildNodeTask;

var copyTaskResources = function (taskMake, srcPath, destPath) {
    assert(taskMake, 'taskMake');
    assert(srcPath, 'srcPath');
    assert(destPath, 'destPath');

    // copy the globally defined set of default task resources
    var toCopy = makeOptions['taskResources'];
    toCopy.forEach(function (item) {
        matchCopy(item, srcPath, destPath, { noRecurse: true, matchBase: true });
    });

    // copy the locally defined set of resources
    if (taskMake.hasOwnProperty('cp')) {
        copyGroups(taskMake.cp, srcPath, destPath);
    }

    // remove the locally defined set of resources
    if (taskMake.hasOwnProperty('rm')) {
        removeGroups(taskMake.rm, destPath);
    }
}
exports.copyTaskResources = copyTaskResources;

var matchFind = function (pattern, root, options) {
    assert(pattern, 'pattern');
    assert(root, 'root');

    // create a copy of the options
    var clone = {};
    Object.keys(options || {}).forEach(function (key) {
        clone[key] = options[key];
    });
    options = clone;

    // determine whether to recurse
    var noRecurse = options.hasOwnProperty('noRecurse') && options.noRecurse;
    delete options.noRecurse;

    // normalize first, so we can substring later
    root = path.resolve(root);

    // determine the list of items
    var items;
    if (noRecurse) {
        items = fs.readdirSync(root)
            .map(function (name) {
                return path.join(root, name);
            });
    }
    else {
        items = find(root)
            .filter(function (item) { // filter out the root folder
                return path.normalize(item) != root;
            });
    }

    return minimatch.match(items, pattern, options);
}
exports.matchFind = matchFind;

var matchCopy = function (pattern, sourceRoot, destRoot, options) {
    assert(pattern, 'pattern');
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');

    console.log(`copying ${pattern}`);

    // normalize first, so we can substring later
    sourceRoot = path.resolve(sourceRoot);
    destRoot = path.resolve(destRoot);

    matchFind(pattern, sourceRoot, options)
        .forEach(function (item) {
            // create the dest dir based on the relative item path
            var relative = item.substring(sourceRoot.length + 1);
            assert(relative, 'relative'); // should always be filterd out by matchFind
            var dest = path.dirname(path.join(destRoot, relative));
            mkdir('-p', dest);

            cp('-Rf', item, dest + '/');
        });
}
exports.matchCopy = matchCopy;

var run = function (cl, inheritStreams, noHeader) {
    if (!noHeader) {
        console.log();
        console.log('> ' + cl);
    }

    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };
    var rc = 0;
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        process.exit(1);
    }

    return (output || '').toString().trim();
}
exports.run = run;

var ensureTool = function (name, versionArgs, validate) {
    console.log(name + ' tool:');
    var toolPath = which(name);
    if (!toolPath) {
        fail(name + ' not found.  might need to run npm install');
    }

    if (versionArgs) {
        var result = exec(name + ' ' + versionArgs);
        if (typeof validate == 'string') {
            if (result.output.trim() != validate) {
                fail('expected version: ' + validate);
            }
        }
        else {
            validate(result.output.trim());
        }
    }

    console.log(toolPath + '');
}
exports.ensureTool = ensureTool;

var installNode = function (nodeVersion) {
    switch (nodeVersion || '') {
        case '':
        case '6':
            nodeVersion = 'v6.10.3';
            break;
        case '5':
            nodeVersion = 'v5.10.1';
            break;
        default:
            fail(`Unexpected node version '${nodeVersion}'. Expected 5 or 6.`);
    }

    if (nodeVersion === run('node -v')) {
        console.log('skipping node install for tests since correct version is running');
        return;
    }

    // determine the platform
    var platform = os.platform();
    if (platform != 'darwin' && platform != 'linux' && platform != 'win32') {
        throw new Error('Unexpected platform: ' + platform);
    }

    var nodeUrl = 'https://nodejs.org/dist';
    switch (platform) {
        case 'darwin':
            var nodeArchivePath = downloadArchive(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-darwin-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-darwin-x64', 'bin'));
            break;
        case 'linux':
            var nodeArchivePath = downloadArchive(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-linux-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-linux-x64', 'bin'));
            break;
        case 'win32':
            var nodeDirectory = path.join(downloadPath, `node-${nodeVersion}`);
            var marker = nodeDirectory + '.completed';
            if (!test('-f', marker)) {
                var nodeExePath = downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.exe');
                var nodeLibPath = downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.lib');
                rm('-Rf', nodeDirectory);
                mkdir('-p', nodeDirectory);
                cp(nodeExePath, path.join(nodeDirectory, 'node.exe'));
                cp(nodeLibPath, path.join(nodeDirectory, 'node.lib'));
                fs.writeFileSync(marker, '');
            }

            addPath(nodeDirectory);
            break;
    }
}
exports.installNode = installNode;

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

    var isZip;
    var isTargz;
    if (omitExtensionCheck) {
        isZip = true;
    }
    else {
        if (url.match(/\.zip$/)) {
            isZip = true;
        }
        else if (url.match(/\.tar\.gz$/) && (process.platform == 'darwin' || process.platform == 'linux')) {
            isTargz = true;
        }
        else {
            throw new Error('Unexpected archive extension');
        }
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
        if (isZip) {
            var zip = new admZip(archivePath);
            zip.extractAllTo(targetPath);
        }
        else if (isTargz) {
            var originalCwd = process.cwd();
            cd(targetPath);
            try {
                run(`tar -xzf "${archivePath}"`);
            }
            finally {
                cd(originalCwd);
            }
        }

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
    //   ],
    //   "dest": "baz/",
    //   "options": "-R"
    // }
    //
    // example to multiply the copy by .NET culture names supported by TFS:
    // {
    //   "source": "<CULTURE_NAME>/foo.dll",
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
    var source = typeof group.source == 'string' ? [group.source] : group.source;
    source = source.map(function (val) { // root the paths
        return path.join(sourceRoot, val);
    });

    // create the destination directory
    var dest = group.dest ? path.join(destRoot, group.dest) : destRoot + '/';
    dest = path.normalize(dest);
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

var removeGroup = function (group, pathRoot) {
    // example structure to remove an array of files/folders:
    // {
    //   "items": [
    //     "foo.dll",
    //     "bar",
    //   ],
    //   "options": "-R"
    // }

    // validate parameters
    assert(group, 'group');
    assert(group.items, 'group.items');
    if (typeof group.items != 'object') {
        throw new Error('Expected group.items to be an array');
    } else {
        assert(group.items.length, 'group.items.length');
        group.items.forEach(function (p) {
            assert(p, 'group.items[i]');
        });
    }

    assert(group.options, 'group.options');
    assert(pathRoot, 'pathRoot');

    // build the rooted items array
    var rootedItems = group.items.map(function (val) { // root the paths
        return path.join(pathRoot, val);
    });

    // remove the items
    rm(group.options, rootedItems);
}

var removeGroups = function (groups, pathRoot) {
    assert(groups, 'groups');
    assert(groups.length, 'groups.length');
    groups.forEach(function (group) {
        removeGroup(group, pathRoot);
    })
}
exports.removeGroups = removeGroups;

var addPath = function (directory) {
    console.log('');
    console.log(`> prepending PATH ${directory}`);

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

    // for any file type that has to be shipped with task
    if (externals.hasOwnProperty('files')) {
        var files = externals.files;
        files.forEach(function (file) {
            assert(file.url, 'file.url');
            assert(file.dest, 'file.dest');

            // download the file from url
            var fileSource = downloadFile(file.url);
            // copy the files
            var fileDest = path.join(destRoot, file.dest);
            mkdir('-p', path.dirname(fileDest));
            cp(fileSource, fileDest);
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

    if (task.hasOwnProperty('releaseNotes')) {
        resources['loc.releaseNotes'] = task.releaseNotes;
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
    if (taskLoc.hasOwnProperty('releaseNotes')) {
        taskLoc.releaseNotes = 'ms-resource:loc.releaseNotes';
    }

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
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// package functions
//------------------------------------------------------------------------------
var linkNonAggregatedLayoutContent = function (sourceRoot, destRoot, metadataOnly) {
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');
    var metadataFileNames = ['TASK.JSON', 'TASK.LOC.JSON', 'STRINGS', 'ICON.PNG'];
    // process each file/folder within the source root
    fs.readdirSync(sourceRoot).forEach(function (itemName) {
        var taskSourcePath = path.join(sourceRoot, itemName);
        var taskDestPath = path.join(destRoot, itemName);

        // skip the Common folder and skip files
        if (itemName == 'Common' || !fs.statSync(taskSourcePath).isDirectory()) {
            return;
        }

        mkdir('-p', taskDestPath);

        // process each file/folder within each task folder
        fs.readdirSync(taskSourcePath).forEach(function (itemName) {
            // skip the Tests folder
            if (itemName == 'Tests') {
                return;
            }

            // when metadataOnly=true, skip non-metadata items
            if (metadataOnly && metadataFileNames.indexOf(itemName.toUpperCase()) < 0) {
                return;
            }

            // create a junction point for directories, hardlink files
            var itemSourcePath = path.join(taskSourcePath, itemName);
            var itemDestPath = path.join(taskDestPath, itemName);
            if (fs.statSync(itemSourcePath).isDirectory()) {
                fs.symlinkSync(itemSourcePath, itemDestPath, 'junction');
            }
            else {
                fs.linkSync(itemSourcePath, itemDestPath);
            }
        });
    });
}

var linkAggregatedLayoutContent = function (sourceRoot, destRoot, release, commit, taskDestMap) {
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');
    assert(commit, 'commit');
    console.log();
    console.log(`> Linking ${path.basename(sourceRoot)}`);
    mkdir('-p', destRoot);

    // process each file/folder within the non-aggregated layout
    fs.readdirSync(sourceRoot).forEach(function (itemName) {
        // skip files
        var taskSourcePath = path.join(sourceRoot, itemName);
        if (!fs.statSync(taskSourcePath).isDirectory()) {
            return;
        }

        // load the source task.json
        var sourceTask = JSON.parse(fs.readFileSync(path.join(taskSourcePath, 'task.json')));
        if (typeof sourceTask.version.Major != 'number' ||
            typeof sourceTask.version.Minor != 'number' ||
            typeof sourceTask.version.Patch != 'number') {

            fail(`Expected task.version.Major/Minor/Patch to be numbers (${taskSourcePath})`);
        }

        // determine the dest folder based on the major version
        assert(sourceTask.id, 'sourceTask.id');
        var taskDestKey = sourceTask.id + '@' + sourceTask.version.Major;
        var taskDestPath = taskDestMap[taskDestKey];
        if (!taskDestPath) {
            taskDestPath = path.join(destRoot, itemName + `__v${sourceTask.version.Major}`);
            taskDestMap[taskDestKey] = taskDestPath;
        }

        if (test('-e', taskDestPath)) {
            // validate that a newer minor+patch does not exist in an older release
            // (newer releases should be linked first)
            var destTask = JSON.parse(fs.readFileSync(path.join(taskDestPath, 'task.json')));
            var sourceVersion = `${sourceTask.version.Major}.${sourceTask.version.Minor}.${sourceTask.version.Patch}`;
            var destVersion = `${destTask.version.Major}.${destTask.version.Minor}.${destTask.version.Patch}`;
            if (semver.gt(sourceVersion, destVersion)) {
                fail(`Expected minor+patch version for task already in the aggregate layout, to be greater or equal than non-aggregated layout being merged. Source task: ${taskSourcePath}`);
            }
        }
        else {
            // create a junction point
            fs.symlinkSync(taskSourcePath, taskDestPath, 'junction');

            // write a human-friendly metadata file
            fs.writeFileSync(taskDestPath + (release ? `_m${release}` : '') + `_${commit}`, '');
        }
    });
}

var getNonAggregatedLayout = function (packagePath, release, commit) {
    assert(packagePath, 'packagePath');
    assert(release, 'release');
    assert(commit, 'commit');

    // validate the zip is in the cache
    var localappdata = process.env.LOCALAPPDATA;
    assert(localappdata, 'LOCALAPPDATA');
    var zipPath = path.join(localappdata, 'vsts-tasks', `non-aggregated-tasks_m${release}_${commit}.zip`);
    var markerPath = `${zipPath}.completed`;
    if (!test('-f', markerPath)) {
        fail(`Non-aggregated layout for m${release} (${commit}) not found in the cache. Publish the latest m${release} and then try again.`);
    }

    // extract
    console.log();
    console.log(`> Expanding ${path.basename(zipPath)}`);
    var destPath = path.join(packagePath, `non-aggregated-layout-m${release}`);
    run(`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "& '${path.join(__dirname, 'Expand-Tasks.ps1')}' -ZipPath '${zipPath}' -TargetPath '${destPath}'"`, /*inheritStreams:*/false, /*noHeader*/true);

    return destPath;
}

var getRefs = function () {
    console.log();
    console.log('> Getting branch/commit info')
    var info = {};
    var branch;
    if (process.env.TF_BUILD) {
        // during CI agent checks out a commit, not a branch.
        // $(build.sourceBranch) indicates the branch name, e.g. releases/m108
        branch = process.env.BUILD_SOURCEBRANCH;
    }
    else {
        // assumes user has checked out a branch. this is a fairly safe assumption.
        // this code only runs during "package" and "publish" build targets, which
        // is not typically run locally.
        branch = run('git symbolic-ref HEAD', /*inheritStreams*/false, /*noHeader*/true);
    }

    assert(branch, 'branch');
    var commit = run('git rev-parse --short=8 HEAD', /*inheritStreams*/false, /*noHeader*/true);
    var release;
    if (branch.match(/^(refs\/heads\/)?releases\/m[0-9]+$/)) {
        release = parseInt(branch.split('/').pop().substr(1));
    }

    // get the ref info for HEAD
    var info = {
        head: {
            branch: branch,  // e.g. refs/heads/releases/m108
            commit: commit,  // leading 8 chars only
            release: release // e.g. 108 or undefined if not a release branch
        },
        releases: {}
    };

    // get the ref info for each release branch within range
    run('git branch --list --remotes "origin/releases/m*"', /*inheritStreams*/false, /*noHeader*/true)
        .split('\n')
        .forEach(function (branch) {
            branch = branch.trim();
            if (!branch.match(/^origin\/releases\/m[0-9]+$/)) {
                return;
            }

            var release = parseInt(branch.split('/').pop().substr(1));

            // filter out releases less than 108 and greater than HEAD
            if (release < 108 ||
                release > (info.head.release || 999)) {

                return;
            }

            branch = 'refs/remotes/' + branch;
            var commit = run(`git rev-parse --short=8 "${branch}"`, /*inheritStreams*/false, /*noHeader*/true);
            info.releases[release] = {
                branch: branch,
                commit: commit,
                release: release
            };
        });

    return info;
}
exports.getRefs = getRefs;

var compressTasks = function (sourceRoot, destPath, individually) {
    assert(sourceRoot, 'sourceRoot');
    assert(destPath, 'destPath');
    run(`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "& '${path.join(__dirname, 'Compress-Tasks.ps1')}' -SourceRoot '${sourceRoot}' -TargetPath '${destPath}' -Individually:${individually ? '$true' : '$false'}"`, /*inheritStreams:*/true, /*noHeader*/true);
}
exports.compressTasks = compressTasks;

var createNonAggregatedZip = function (buildPath, packagePath) {
    console.log();
    console.log('> Creating non aggregate zip');
    assert(buildPath, 'buildPath');
    assert(packagePath, 'packagePath');

    // build the layout for the nested task zips
    console.log();
    console.log('> Linking content for nested task zips');
    var nestedZipsContentPath = path.join(packagePath, 'nested-zips-layout');
    linkNonAggregatedLayoutContent(buildPath, nestedZipsContentPath, /*metadataOnly*/false);

    // create the nested task zips (part of the non-aggregated tasks layout)
    console.log();
    console.log('> Creating nested task zips (content for non-aggregated tasks layout)');
    var nonAggregatedLayoutPath = path.join(packagePath, 'non-aggregated-layout');
    compressTasks(nestedZipsContentPath, nonAggregatedLayoutPath, /*individually:*/true);

    // link the task metadata into the non-aggregated tasks layout
    console.log();
    console.log('> Linking metadata content for non-aggregated tasks layout');
    linkNonAggregatedLayoutContent(buildPath, nonAggregatedLayoutPath, /*metadataOnly*/true);

    // mark the layout with a version number.
    // servicing supports both this new format and the legacy layout format as well.
    fs.writeFileSync(path.join(nonAggregatedLayoutPath, 'layout-version.txt'), '2');

    // create the non-aggregated tasks zip
    console.log();
    console.log('> Zipping non-aggregated tasks layout');
    var nonAggregatedZipPath = path.join(packagePath, 'non-aggregated-tasks.zip');
    compressTasks(nonAggregatedLayoutPath, nonAggregatedZipPath);

    return nonAggregatedLayoutPath;
}
exports.createNonAggregatedZip = createNonAggregatedZip;

var createHotfixLayout = function (packagePath, taskName) {
    assert(packagePath, 'packagePath');
    assert(taskName, 'taskName');
    console.log();
    console.log(`> Creating hotfix layout for task '${taskName}'`);

    var branch = null;
    if (process.env.TF_BUILD) {
        // during CI agent checks out a commit, not a branch.
        // $(build.sourceBranch) indicates the branch name, e.g. releases/m108
        branch = process.env.BUILD_SOURCEBRANCH;
    }
    else {
        // assumes user has checked out a branch. this is a fairly safe assumption.
        // this code only runs during "package" and "publish" build targets, which
        // is not typically run locally.
        branch = run('git symbolic-ref HEAD', /*inheritStreams*/false, /*noHeader*/true);
    }

    var commitInfo = run('git log -1 --format=oneline', /*inheritStreams*/false, /*noHeader*/true);

    // create the script
    var hotfixPath = path.join(packagePath, 'hotfix');
    mkdir('-p', hotfixPath);
    var scriptPath = path.join(hotfixPath, `${taskName}.ps1`);
    var scriptContent = '# Hotfix created from branch: ' + branch + os.EOL;
    scriptContent += '# Commit: ' + commitInfo + os.EOL;
    scriptContent += '$ErrorActionPreference=\'Stop\'' + os.EOL;
    scriptContent += 'Update-DistributedTaskDefinitions -TaskZip $PSScriptRoot\\tasks.zip' + os.EOL;
    fs.writeFileSync(scriptPath, scriptContent);

    // link the non-aggregated tasks zip
    var zipSourcePath = path.join(packagePath, 'non-aggregated-tasks.zip');
    var zipDestPath = path.join(hotfixPath, 'tasks.zip');
    cp(zipSourcePath, zipDestPath);
}
exports.createHotfixLayout = createHotfixLayout;

var createAggregatedZip = function (packagePath) {
    assert(packagePath, 'packagePath');

    // get branch/commit info
    var refs = getRefs();

    // initialize the aggregated layout
    // mark the layout with a version number.
    // servicing supports both this new format and the legacy layout format as well.
    console.log();
    console.log('> Creating aggregated layout');
    var aggregatedLayoutPath = path.join(packagePath, 'aggregated-layout');
    mkdir('-p', aggregatedLayoutPath);
    fs.writeFileSync(path.join(aggregatedLayoutPath, 'layout-version.txt'), '2');

    // track task GUID + major version -> destination path
    // task directory names can change between different release branches
    var taskDestMap = {};

    // link the tasks from the non-aggregated layout into the aggregated layout
    var nonAggregatedLayoutPath = path.join(packagePath, 'non-aggregated-layout');
    linkAggregatedLayoutContent(nonAggregatedLayoutPath, aggregatedLayoutPath, /*release:*/'', /*commit:*/refs.head.commit, taskDestMap);

    // link the tasks from previous releases into the aggregated layout
    Object.keys(refs.releases)
        .sort()
        .reverse()
        .forEach(function (release) {
            // skip the current release (already covered by current build)
            if (release == refs.head.release) {
                return;
            }

            var commit = refs.releases[release].commit;
            var releaseLayout = getNonAggregatedLayout(packagePath, release, commit);
            linkAggregatedLayoutContent(releaseLayout, aggregatedLayoutPath, /*release:*/release, /*commit:*/commit, taskDestMap);
        });

    // validate task uniqueness within the layout based on task GUID + major version
    var majorVersions = {};
    fs.readdirSync(aggregatedLayoutPath) // walk each item in the aggregate layout
        .forEach(function (itemName) {
            var itemPath = path.join(aggregatedLayoutPath, itemName);
            if (!fs.statSync(itemPath).isDirectory()) { // skip files
                return;
            }

            // load the task.json
            var taskPath = path.join(itemPath, 'task.json');
            var task = JSON.parse(fs.readFileSync(taskPath));
            if (typeof task.version.Major != 'number') {
                fail(`Expected task.version.Major/Minor/Patch to be a number (${taskPath})`);
            }

            assert(task.id, `task.id (${taskPath})`);
            if (typeof task.id != 'string') {
                fail(`Expected id to be a string (${taskPath})`);
            }

            // validate GUID + Major version is unique
            var key = task.id + task.version.Major;
            if (majorVersions[key]) {
                fail(`Tasks GUID + Major version must be unique within the aggregated layout. Task 1: ${majorVersions[key]}; task 2: ${taskPath}`);
            }

            majorVersions[key] = taskPath;
        });

    // create the aggregated tasks zip
    console.log();
    console.log('> Zipping aggregated tasks layout');
    var aggregatedZipPath = path.join(packagePath, 'pack-source', 'contents', 'Microsoft.TeamFoundation.Build.Tasks.zip');
    mkdir('-p', path.dirname(aggregatedZipPath));
    compressTasks(aggregatedLayoutPath, aggregatedZipPath);
}
exports.createAggregatedZip = createAggregatedZip;

var storeNonAggregatedZip = function (zipPath, release, commit) {
    assert(zipPath, 'zipPath');
    ensureExists(zipPath);
    assert(release, 'release');
    assert(commit, 'commit');

    console.log();
    console.log(`> Storing non-aggregated zip (m${release} ${commit})`);

    // determine the destination dir
    var localappdata = process.env.LOCALAPPDATA;
    assert(localappdata, 'LOCALAPPDATA');
    var destDir = path.join(localappdata, 'vsts-tasks');
    mkdir('-p', destDir);

    // remove old packages for same release branch
    rm(path.join(destDir, `non-aggregated-tasks_m${release}_*`))

    // copy the zip
    var destZip = path.join(destDir, `non-aggregated-tasks_m${release}_${commit}.zip`);
    cp(zipPath, destZip);

    // write the completed marker file
    var destMarker = `${destZip}.completed`;
    fs.writeFileSync(destMarker, '');
}
exports.storeNonAggregatedZip = storeNonAggregatedZip;

// TODO: Update all these comments considering changes for running locally.
// Overview:
// 
// This script starts with having a folder per task with the content for each task inside(comes from combining the slices).
// First we need to copy this to a per-task-layout folder.
// We start by adding a .nuspec file for each task inside the task folder.
// Then we iterate each of these tasks and create a .nupkg and push.cmd per task.
// The pushed artifact has a folder per task that was built and inside that folder is a .nupkg and push.cmd for the task.
// 
// Folder structure: TODO, add examples at each stage

// Stage 1: Build tasks

// Stage 2: Create non aggregated zip

// Stage 3: Zip entire task contents to FULL TASK NAME.zip

// Stage 4: Create nuspec files

// Stage 5: Create nuget packages and push.cmd and push-all.cmd


// TODO: Redo this for new path structure that works both locally and on server
// _package
//  /per-task-layout (util.perTaskLayoutPath)
//      /CmdLineV2__v2 // Keep "__v2" until everyone has version in their task name.
//          /Strings
//          /task.json
//          /task.loc.json
//          /task.zip
//          /Mseng.MS.TF.DistributedTask.Tasks.CmdLineV2__v2.nuspec *created in this script
// 
//  /per-task-publish (util.perTaskPublishPath)
//      /CmdLineV2__v2 //  Keep "__v2" until everyone has version in their task name.
//          Mseng.MS.TF.DistributedTask.Tasks.CmdLine.2.132.0.nupkg * created in this script
//          push.cmd * created in this script
//      push-all.cmd (courtesy script that runs all push.cmds, we will run this once a sprint and force a build all) TODO: Create this.
// 
// Notes:
// 
// Currently the code works within the legacy setup of having multiple slices that are pushed as artifacts and then recombined.
// Once this code is live for a while we will remove that legacy code and it should simplify the setup here. We can use the original 
//    build folders for each task in place of the per-task-layout.
var createNugetPackagePerTask = function (packagePath, /*nonAggregatedLayoutPath*/layoutPath) {
    console.log();
    console.log('> Creating NuGet package per task')

    // create folder for _package\task-zips
    console.log();
    console.log('> Creating task zips folder');
    var tasksZipsPath = path.join(packagePath, 'task-zips');
    mkdir('-p', tasksZipsPath);

    // _package\artifacts
    // This is the final state of the task content and what is published.
    console.log();
    console.log('> Creating artifacts folder');
    var artifactsPath = path.join(packagePath, "artifacts");
    mkdir('-p', artifactsPath);

    console.log();
    console.log('> Zipping task folders')

    var unifiedDepsContent = '';
    var servicingXmlContent = '';

    fs.readdirSync(layoutPath)
        .forEach(function (taskFolderName) {
            var taskLayoutPath = path.join(layoutPath, taskFolderName);

            if (!fs.statSync(taskLayoutPath).isDirectory) {
                return;
            }

            // TODO: I think we can get rid of this.
            if (taskFolderName === 'layout-version.txt') { // TODO: Clean this up. Make sure we have layout-version in each task nuget package? I think we need it? Is it applicable in nuget package per task setup?
                return;
            }
            
            
            var taskJsonPath = path.join(taskLayoutPath, 'task.json');
            var taskJsonContents = JSON.parse(fs.readFileSync(taskJsonPath));

            // extract values that we need from task.json
            var taskVersion = taskJsonContents.version.Major + '.' + taskJsonContents.version.Minor + '.' + taskJsonContents.version.Patch;
            var taskName = taskJsonContents.name;
            var fullTaskName = 'Mseng.MS.TF.DistributedTask.Tasks.' + taskName;

            // Create xml entries for UnifiedDependencies
            // <package id="Mseng.MS.TF.Build.Tasks.AzureCLI" version="1.132.0" availableAtDeployTime="true" />
            unifiedDepsContent += `  <package id="${fullTaskName}" version="${taskVersion}" availableAtDeployTime="true" />` + os.EOL;

            // Create xml entries for servicing
            // 	<File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.XCode/*?version=2.121.0" />
            servicingXmlContent += 	`<File Origin="nuget://${fullTaskName}/*?version=${taskVersion}" />` + os.EOL;

            // Create a matching folder inside taskZipsPath
            var taskZipPath = path.join(tasksZipsPath, taskFolderName);
            mkdir('-p', taskZipPath);
            console.log('root task folder: ' + taskZipPath);

            // Create a task folder inside the folder so that when we do a nuget pack the contents are inside a folder.
            // This makes things easier/cleaner downstream when we do servicing and prevents needing to zip the contents
            //  a second time.
            // TODO: Provide an example and downstream consumption case?
            // TODO: I think there is a bug here, tasksZipsPath should be taskZipPath?
            // Old, think theres a bug
            //var folderInsideFolderPath = path.join(tasksZipsPath, taskFolderName);
            // New, should be nested
            var folderInsideFolderPath = path.join(taskZipPath, taskFolderName);
            mkdir('-p', folderInsideFolderPath);
            console.log('nested folder: ' + folderInsideFolderPath);

            // TOOD: This is probably slow. Check other code to do hard sync?
            var copydir = require('copy-dir');
            copydir.sync(taskLayoutPath, folderInsideFolderPath);
            //fs.copyFileSync(taskLayoutPath, taskZipPath);


            // Zip the folder from non aggregated layout and name it based on task.json contents. TODO: Refactor this to method?
            // TODO IMPORTANT: We want to zip it as an entire folder so that when we unzip it's a full folder? Makes the servicing processing simpler.
            // var taskZip = new admZip();
            // taskZip.addLocalFolder(taskLayoutPath);
            // taskZip.writeZip(path.join(taskZipPath, `${fullTaskName}.zip`));

            // Now we can create the nuspec file, nupkg, and push.cmd
            // var taskNuspecPath = createNuspecFile(taskLayoutPath, fullTaskName, taskVersion);
            var taskNuspecPath = createNuspecFile(taskZipPath, fullTaskName, taskVersion);

            // var taskArtifactFolder = path.join(artifactsPath, taskFolderName);
            // mkdir('-p', taskArtifactFolder);
            
            //var taskPublishFolder = createNuGetPackage(artifactsPath, taskFolderName, taskNuspecPath, taskLayoutPath);
            var taskPublishFolder = createNuGetPackage(artifactsPath, taskFolderName, taskNuspecPath, taskZipPath);
            createPushCmd(taskPublishFolder, fullTaskName, taskVersion);
        });

    // Create root push.cmd
    console.log();
    console.log('> Creating root push.cmd')
    var contents = 'for /D %%s in (.\\*) do ( ' + os.EOL;
    contents +=     'pushd %%s' + os.EOL;
    contents +=     'push.cmd' + os.EOL;
    contents +=     'popd' + os.EOL;
    contents += ')';
    var rootPushCmdPath = path.join(artifactsPath, 'push.cmd');
    fs.writeFileSync(rootPushCmdPath, contents);

    // Create xml entries for UnifiedDependencies
    // <package id="Mseng.MS.TF.Build.Tasks.AzureCLI" version="1.132.0" availableAtDeployTime="true" />
    console.log('> Generating XML dependencies for UnifiedDependencies');
    var depsContentPath = path.join(artifactsPath, 'unified_deps.xml');
    fs.writeFileSync(depsContentPath, unifiedDepsContent);

    // Create xml entries for servicing
    // 	<File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.XCode/*?version=2.121.0" />
    console.log('> Generating XML dependencies for Servicing');
    var servicingContentPath = path.join(artifactsPath, 'servicing.xml');
    fs.writeFileSync(servicingContentPath, servicingXmlContent);
}
exports.createNugetPackagePerTask = createNugetPackagePerTask;

/**
 * Create .nuspec file for the task.
 * @param {*} taskLayoutPath Layout path for the specific task we are creating nuspec for. e.g. - _package\per-task-layout\AzurePowerShellV3__v3
 * @param {*} fullTaskName Full name of the task. e.g - AzureCLIV2
 * @param {*} taskVersion taskVersion Version of the task. e.g - 1.132.0
 * @returns Path of the nuspec file that was created. // e.g. - _package\per-task-layout\AzureCLIV1__v1\Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1.nuspec
 */
var createNuspecFile = function (taskLayoutPath, fullTaskName, taskVersion) {
    console.log('> Creating nuspec file');
    
    var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
    contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
    contents += '   <metadata>' + os.EOL;
    contents += '      <id>' + fullTaskName + '</id>' + os.EOL;
    contents += '      <version>' + taskVersion + '</version>' + os.EOL;
    contents += '      <authors>bigbldt</authors>' + os.EOL;
    contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
    contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
    contents += '      <description>For VSS internal use only</description>' + os.EOL;
    contents += '      <tags>VSSInternal</tags>' + os.EOL;
    contents += '   </metadata>' + os.EOL;

    // // start experiment
    // contents += '<files>' + os.EOL;
    // contents += '<file src="**\*.*" target="MyLib" />' + os.EOL;
    // contents += '</files>' + os.EOL;
    // // end experiment

    contents += '</package>' + os.EOL;

    var taskNuspecPath = path.join(taskLayoutPath, fullTaskName + '.nuspec');
    console.log('taskNuspecPath: ' + taskNuspecPath);
    fs.writeFileSync(taskNuspecPath, contents);

    return taskNuspecPath;
}

/**
 * Create .nupkg for a specific task.
 * @param {*} publishPath X. e.g - _package\per-task-publish
 * @param {*} taskFolderName X. e.g - AzurePowerShellV3__v3
 * @param {*} taskNuspecPath X. e.g - _package\per-task-layout\AzureCLIV1__v1\Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1.nuspec
 * @param {*} taskLayoutPath X. e.g - _package\per-task-layout\AzurePowerShellV3__v3
 * @returns Publish folder for the task. e.g - _package\per-task-publish\AzurePowerShellV3__v3
 */
var createNuGetPackage = function (publishPath, taskFolderName, taskNuspecPath, taskLayoutPath) {
    console.log('> Creating nuget package for task ' + taskFolderName);
    
    var taskPublishFolder = path.join(publishPath, taskFolderName);
    fs.mkdirSync(taskPublishFolder);
    process.chdir(taskPublishFolder);

    console.log('task nuspec path: ' + taskNuspecPath);
    console.log('base path: ' + taskLayoutPath)
    run(`nuget pack "${taskNuspecPath}" -BasePath "${taskLayoutPath}" -NoDefaultExcludes`, /*inheritStreams:*/ true);

    return taskPublishFolder;
}

/**
 * Create push.cmd for the task.
 * @param {*} taskPublishFolder Folder where we are publishing tasks from. e.g - _package\per-task-publish\AzureCLIV1__v1
 * @param {*} fullTaskName Full name of the task. e.g - Mseng.MS.TF.Build.Tasks.AzureCLI
 * @param {*} taskVersion Version of the task. e.g - 1.132.0
 */
var createPushCmd = function (taskPublishFolder, fullTaskName, taskVersion) {
    console.log('> Creating push.cmd for task ' + fullTaskName);

    var taskPushCmdPath = path.join(taskPublishFolder, 'push.cmd');
    var nupkgName = `${fullTaskName}.${taskVersion}.nupkg`;

    // TODO: I think we just need to rename this, the name is not accurate. It's the tasks feed url that we happen to push the aggregate to. It's not a specific link for the aggregate.
    var taskFeedUrl = process.env.AGGREGATE_TASKS_FEED_URL; // Need the task feed per task. This is based on task name from task.json too? Can we append based on name?
    var apiKey = 'Skyrise';

    var taskFeedUrl = "http://localhost:44396/nuget";
    var apiKey = '123456';
    
    fs.writeFileSync(taskPushCmdPath, `nuget.exe push ${nupkgName} -source "${taskFeedUrl}" -apikey ${apiKey}`);
}
