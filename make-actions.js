const fs = require('fs');
const path = require('path');

const util = require('./make-util');
const {
    test,
    rm,
    cd,
    run,
    fail,
    fileToJson,
    copyTaskResources,
    getExternals,
    createResjson,
    buildNodeTask,
    getCommonPackInfo
} = util;

// Common constants
const PROJECT_ROOT = __dirname;

// src constants
const TASKS_PATH = path.join(PROJECT_ROOT, 'Tasks');
const COMMON_MODULES_PATH = path.join(TASKS_PATH, 'Common');

// Build constants
const BUILD_PATH = path.join(PROJECT_ROOT, '_build');
const BUILD_TASKS_PATH = path.join(BUILD_PATH, 'Tasks');
const BUILD_COMMON_MODULES_PATH = path.join(BUILD_TASKS_PATH, 'Common');

function buildCommonModule(moduleName, force) {
    const moduleOutDir = path.join(BUILD_COMMON_MODULES_PATH, moduleName);

    if (test('-d', moduleOutDir) && !force) {
        console.log(`Module ${moduleName} already exists. Skipping.`);
        return;
    }

    console.log('Removing old module build')
    rm('-Rf', moduleOutDir);

    // TODO: support nested modules e.g. Deployment/TelemetryHelper
    const commonModules = fs.readdirSync(COMMON_MODULES_PATH);
    if (!commonModules.includes(moduleName)) {
        fail(`Module ${moduleName} does not exist in ${COMMON_MODULES_PATH}`);
    }

    const modulePath = path.join(COMMON_MODULES_PATH, moduleName);

    // create loc files
    var modJsonPath = path.join(modulePath, 'module.json');
    if (!test('-f', modJsonPath)) {
        fail(`module.json not found in ${modulePath}`);
    }

    const moduleConfig = fileToJson(modJsonPath);

    createResjson(moduleConfig, modulePath);

    // copy default resources and any additional resources defined in the module's make.json
    console.log('\n> copying module resources');
    const moduleMakePath = path.join(modulePath, 'make.json');
    const moduleMake = test('-f', moduleMakePath) ? fileToJson(moduleMakePath) : {};
    copyTaskResources(moduleMake, modulePath, moduleOutDir);

    console.log('get externals');
    if (moduleMake.hasOwnProperty('externals')) {
        console.log('');
        console.log('> getting module externals');
        getExternals(moduleMake.externals, moduleOutDir);
    }

    // npm install, compile and pack node modules.
    if (moduleConfig.moduleType === 'node' && moduleConfig.compile == true) {
        if (test('-f', path.join(modulePath, 'tsconfig.json'))) {
            buildNodeTask(modulePath, moduleOutDir);
        }

        if (test('-f', path.join(modulePath, 'package.json'))){
            var commonPack = getCommonPackInfo(moduleOutDir);

            // assert the pack file does not already exist (name should be unique)
            if (test('-f', commonPack.packFilePath)) {
                console.log(`Pack file already exists: ${commonPack.packFilePath}`);
                return;
            }

            // pack the Node module. a pack file is required for dedupe.
            // installing from a folder creates a symlink, and does not dedupe.
            cd(path.dirname(moduleOutDir));
            run(`npm pack ./${path.basename(moduleOutDir)}`);
        }

    }
}
module.exports.buildCommonModule = buildCommonModule;
