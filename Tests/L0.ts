/// <reference path="../definitions/mocha.d.ts"/>
/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import fs = require('fs');

describe('General Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {

    });

    it('Find invalid task.json', (done) => {
        this.timeout(20000);

        // get a list of all _build/task folders
        var tasksRootFolder = path.resolve(__dirname, '../Tasks');
        var taskFolders: string[] = [];
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            if (folderName != 'Common' && fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) {
                taskFolders.push(path.join(tasksRootFolder, folderName));
            }
        })

        // verify no BOM
        for (var i = 0; i < taskFolders.length; i++) {
            var taskFolder = taskFolders[i];
            var taskjson = path.join(taskFolder, 'task.json');
            var jsonString = fs.readFileSync(taskjson).toString();
            if (jsonString.indexOf('\uFEFF') >= 0) {
                console.warn('The task.json starts with a byte-order mark. This may cause JSON.parse to fail.');
                console.warn('The byte-order mark has been removed from the task.json file under the _build directory.');
                console.warn('Copy the file over the source file in the task folder and commit it.');
                var fixedJsonString = jsonString.replace(/[\uFEFF]/g, '');
                fs.writeFileSync(taskjson, fixedJsonString);
                assert(false, 'Offending file (byte-order mark removed): ' + taskjson);
            }
            try {
                var task = JSON.parse(fs.readFileSync(taskjson).toString());
            }
            catch (err) {
                assert(false, err.message + '\n\tUnable to parse JSON from: ' + taskjson);
            }
        }

        done();
    })

    it('Find nested task.json', (done) => {
        this.timeout(20000);

        // Path to the _build/Tasks folder.
        var tasksFolder = path.resolve(__dirname, '../Tasks');

        // Recursively find all task.json files.
        var folders: string[] = [tasksFolder];
        while (folders.length > 0) {
            // Pop the next folder.
            var folder: string = folders.pop();

            // Read the directory.
            fs.readdirSync(folder).forEach(item => {
                var itemPath: string = path.join(folder, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    // Push the child directory.
                    folders.push(itemPath);
                } else if (item.toUpperCase() == "TASK.JSON" &&
                    path.resolve(folder, '..').toUpperCase() != tasksFolder.toUpperCase()) {

                    // A task.json file was found nested recursively within the task folder.
                    assert(false, 'A task.json file was found nested recursively within the task folder. This will break the servicing step. Offending file: ' + itemPath);
                }
            });
        }

        done();
    })

    it('Find .js with uppercase', (done) => {
        this.timeout(20000);

        // Path to the _build/Tasks folder.
        var tasksRootFolder = path.resolve(__dirname, '../Tasks');

        var taskFolders: string[] = [];
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            if (folderName != 'Common' && fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) {
                taskFolders.push(path.join(tasksRootFolder, folderName));
            }
        })

        for (var i = 0; i < taskFolders.length; i++) {
            var taskFolder = taskFolders[i];

            var taskjson = path.join(taskFolder, 'task.json');
            var task = JSON.parse(fs.readFileSync(taskjson).toString());

            if (task.execution['Node']) {

                var jsFiles = fs.readdirSync(taskFolder).filter(file => {
                    return file.search(/\.js$/) > 0;
                })

                jsFiles.forEach(jsFile => {
                    if (jsFile.search(/[A-Z]/g) >= 0) {
                        console.error('Has uppercase in .js file name for tasks: ' + path.relative(tasksRootFolder, taskjson));
                        assert(false, 'Has uppercase is dangerous for xplat tasks.' + taskjson);
                    }
                })

                var targetJs = task.execution['Node'].target;
                if (targetJs.search(/[A-Z]/g) >= 0) {
                    console.error('Has uppercase in task.json\'s execution.node.target for tasks: ' + path.relative(tasksRootFolder, taskjson));
                    assert(false, 'Has uppercase is dangerous for xplat tasks.' + taskjson);
                }
            }
        }

        done();
    })

    it('Find unsupported demands', (done) => {
        this.timeout(20000);

        var supportedDemands: string[] = ['AndroidSDK',
            'ant',
            'AzurePS',
            'Chef',
            'DotNetFramework',
            'java',
            'JDK',
            'maven',
            'MSBuild',
            'MSBuild_x64',
            'npm',
            'node.js',
            'PowerShell',
            'SqlPackage',
            'VisualStudio',
            'VisualStudio_IDE',
            'VSTest',
            'WindowsKit',
            'WindowsSdk',
            'cmake',
            'cocoapods',
            'curl',
            'Cmd',
            'SCVMMAdminConsole',
            'sh',
            'KnifeReporting',
            'Xamarin.Android',
            'Xamarin.iOS',
            'xcode'];

        supportedDemands.forEach(demand => {
            if (supportedDemands.indexOf(demand.toLocaleLowerCase()) < 0) {
                supportedDemands.push(demand.toLocaleLowerCase());
            }
        });

        // Path to the _build/Tasks folder.
        var tasksRootFolder = path.resolve(__dirname, '../Tasks');

        var taskFolders: string[] = [];
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            if (folderName != 'Common' && fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) {
                taskFolders.push(path.join(tasksRootFolder, folderName));
            }
        })

        var unsupportedDemands: string[] = [];
        for (var i = 0; i < taskFolders.length; i++) {
            var taskFolder = taskFolders[i];
            var taskjson = path.join(taskFolder, 'task.json');

            var task = JSON.parse(fs.readFileSync(taskjson).toString());
            if (task.hasOwnProperty('demands')) {
                task['demands'].forEach(demand => {
                    if (supportedDemands.indexOf(demand.toLocaleLowerCase()) < 0) {
                        console.warn('find unsupported demand: ' + demand + ' in ' + taskjson);
                        console.warn('fix the unit test if the new demand is added on purpose.');
                        unsupportedDemands.push(demand);
                    }
                });
            }
        }

        if (unsupportedDemands.length > 0) {
            assert(false, 'find unsupported demands, please take necessary operation to fix this. unsupported demands count: ' + unsupportedDemands.length);
        }

        done();
    })

    it('Find invalid message key in task.json', (done) => {
        this.timeout(20000);

        // get all task.json and module.json paths under _build/Tasks.
        var tasksRootFolder = path.resolve(__dirname, '../Tasks');
        var jsons: string[] = [];
        fs.readdirSync(tasksRootFolder).forEach(name => {
            let itemPath = path.join(tasksRootFolder, name);
            if (name == 'Common') {
                fs.readdirSync(itemPath).forEach(name => {
                    let nestedItemPath = path.join(itemPath, name);
                    if (fs.statSync(nestedItemPath).isDirectory()) {
                        let moduleJsonPath = path.join(nestedItemPath, 'module.json');
                        try {
                            fs.statSync(moduleJsonPath);
                        }
                        catch (err) {
                            return;
                        }

                        jsons.push(moduleJsonPath);
                    }
                });
            }
            else if (fs.statSync(itemPath).isDirectory()) {
                jsons.push(path.join(itemPath, 'task.json'));
            }
        });

        for (var i = 0; i < jsons.length; i++) {
            var json = jsons[i];
            var obj = JSON.parse(fs.readFileSync(json).toString());
            if (obj.hasOwnProperty('messages')) {
                for (var key in obj.messages) {
                    var jsonName = path.relative(tasksRootFolder, json);
                    assert(key.search(/\W+/gi) < 0, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' contain non-word characters, only allows [a-zA-Z0-9_].'));
                    if (typeof (obj.messages[key]) === 'object') {
                        assert(obj.messages[key].loc, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' should have a loc string.'));
                        assert(obj.messages[key].loc.toString().length >= 0, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' should have a loc string.'));
                        assert(obj.messages[key].fallback, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' should have a fallback string.'));
                        assert(obj.messages[key].fallback.toString().length > 0, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' should have a fallback string.'));
                    }
                    else if (typeof (obj.messages[key]) === 'string') {
                        assert(obj.messages[key].toString().length > 0, ('(' + jsonName + ')' + 'messages key: \'' + key + '\' should have a loc string.'));
                    }
                }
            }
        }

        done();
    })

    it('Find missing string in .ts', (done: MochaDone) => {
        this.timeout(20000);

        // search the source dir for all _build/Tasks and module folders.
        let tasksPath = path.resolve(__dirname, '../Tasks');
        let taskPaths: string[] = [];
        fs.readdirSync(tasksPath).forEach((itemName: string) => {
            let itemPath = path.join(tasksPath, itemName);
            if (itemName != 'Common' && fs.statSync(itemPath).isDirectory()) {
                taskPaths.push(itemPath);
            }
        });

        let commonPath = path.join(tasksPath, 'Common');
        var commonItems = [];
        try {
            commonItems = fs.readdirSync(commonPath);
        }
        catch (err) {
            if (err.code != 'ENOENT') {
                assert('Unexpected error reading dir: ' + commonPath);
            }
        }

        commonItems.forEach((itemName: string) => {
            let itemPath = path.join(commonPath, itemName);
            if (fs.statSync(itemPath).isDirectory()) {
                taskPaths.push(itemPath);
            }
        });

        var testFailed: boolean = false;

        taskPaths.forEach((taskPath: string) => {
            var locStringMismatch: boolean = false;

            // load the task.json or module.json if exists
            let taskJson;
            for (let jsonName of ['task.json', 'module.json']) {
                let jsonPath = path.join(taskPath, jsonName);
                try {
                    fs.statSync(jsonPath);
                }
                catch (err) {
                    return;
                }

                taskJson = JSON.parse(fs.readFileSync(jsonPath).toString());
                break;
            }

            // recursively find all .ts files
            let tsFiles: string[] = [];
            let dirs: string[] = [taskPath];
            while (dirs.length) {
                let dir: string = dirs.pop();
                fs.readdirSync(dir).forEach((itemName: string) => {
                    let itemPath: string = path.join(dir, itemName);
                    if (fs.statSync(itemPath).isDirectory() && itemName != 'node_modules') {
                        dirs.push(itemPath);
                    }
                    else if (itemName.search(/\.ts$/) > 0) {
                        tsFiles.push(itemPath);
                    }
                });
            }

            // search for all loc string keys
            let locStringKeys: string[] = [];
            tsFiles.forEach((tsFile: string) => {
                let content = fs.readFileSync(tsFile).toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                let lines: string[] = content.split('\n');
                lines.forEach(line => {
                    // remove all spaces.
                    line = line.replace(/ /g, '');

                    let regx = /tl\.loc\(('(\w+)'|"(\w+)")/i;
                    let res = regx.exec(line);
                    if (res) {
                        let key;
                        if (res[2]) {
                            key = res[2];
                        }
                        else if (res[3]) {
                            key = res[3];
                        }

                        locStringKeys.push(key);
                    }
                });
            });

            // load the keys from the task.json/module.json
            let locStringKeysFromJson: string[] = [];
            if (taskJson && taskJson.hasOwnProperty('messages')) {
                Object.keys(taskJson.messages).forEach((key: string) => {
                    locStringKeysFromJson.push(key);
                });
            }

            // find missing keys
            var missingLocStringKeys: string[] = [];
            locStringKeys.forEach((locKey: string) => {
                if (locStringKeysFromJson.indexOf(locKey) === -1 &&
                    !locKey.match(/^LIB_/)) { // some tasks refernce lib strings

                    locStringMismatch = true;
                    missingLocStringKeys.push(locKey);
                }
            })

            if (locStringMismatch) {
                testFailed = true;
                console.error('add missing loc string keys to messages section for task.json/module.json: ' + path.relative(tasksPath, taskPath));
                console.error(JSON.stringify(missingLocStringKeys));
            }
        });

        assert(!testFailed, 'there are missing loc string keys in task.json/module.json.');

        done();
    })

    it('Find missing string in .ps1/.psm1', (done) => {
        this.timeout(20000);

        // Push all _build/Tasks folders onto the stack.
        var folders: string[] = [];
        var tasksRootFolder = path.resolve(__dirname, '../Tasks');
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            var folder = path.join(tasksRootFolder, folderName);
            if (folderName != 'Common' && fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        // Push each Common module folder onto the stack. The Common folder does not
        // get copied under _build so scan the source copy instead.
        var commonFolder = path.resolve(__dirname, "../Tasks/Common");
        var commonItems = [];
        try {
            commonItems = fs.readdirSync(commonFolder);
        }
        catch (err) {
            if (err.code != 'ENOENT') {
                assert('Unexpected error reading dir: ' + commonFolder);
            }
        }

        commonItems.forEach(folderName => {
            var folder = path.join(commonFolder, folderName);
            if (fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        folders.forEach(folder => {
            // Load the task.json or module.json if one exists.
            var jsonFile = path.join(folder, 'task.json');
            var obj = { "messages": {} }
            if (fs.existsSync(jsonFile) || fs.existsSync(jsonFile = path.join(folder, "module.json"))) {
                obj = JSON.parse(fs.readFileSync(jsonFile).toString());
            } else {
                jsonFile = ''
            }

            // Recursively find all PS files.
            var psFiles: string[] = [];
            var folderStack: string[] = [folder];
            while (folderStack.length > 0) {
                folder = folderStack.pop();
                if (path.basename(folder).toLowerCase() == "ps_modules") { continue } // Skip nested ps_modules folder.
                fs.readdirSync(folder).forEach(itemName => {
                    var itemPath = path.join(folder, itemName);
                    if (fs.statSync(itemPath).isDirectory()) {
                        folderStack.push(itemPath);
                    } else if (itemPath.toLowerCase().search(/\.ps1$/) > 0
                        || itemPath.toLowerCase().search(/\.psm1$/) > 0) {
                        psFiles.push(itemPath);
                    }
                })
            }

            psFiles.forEach(psFile => {
                var ps = fs.readFileSync(psFile).toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                var lines: string[] = ps.split('\n');
                lines.forEach(line => {
                    if (line.search(/Get-VstsLocString/i) > 0) {
                        var result = /Get-VstsLocString +-Key +('[^']+'|"[^"]+"|[^ )]+)/i.exec(line);
                        if (!result) {
                            assert(false, 'Bad format string in file ' + psFile + ' on line: ' + line);
                        }

                        var key = result[1].replace(/['"]/g, "");
                        assert(
                            obj.hasOwnProperty('messages') && obj.messages.hasOwnProperty(key),
                            "Loc resource key not found in task.json/module.json. Resource key: '" + key + "', PS file: '" + psFile + "', JSON file: '" + jsonFile + "'.");
                    }
                });
            })
        })
        done();
    })
});
