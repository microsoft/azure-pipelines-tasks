/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
// Module dependencies
var fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    glob = require("glob"),
    exec = Q.nfbind(require('child_process').exec);

// Constants
var DEFAULT_CORDOVA_VERSION = "5.1.1",
    // Support plugin adds in two VS features and a set of bug fixes. Plugin needs to be local due to a bug in Cordova 5.1.1 when fetching from Git.
//    SUPPORT_PLUGIN = path.join(__dirname,"taco-cordova-support-plugin"),
    SUPPORT_PLUGIN = "https://github.com/Chuxel/taco-cordova-support-plugin.git",
    SUPPORT_PLUGIN_ID = "cordova-plugin-vs-taco-support",
    OLD_SUPPORT_PLUGIN_ID = "com.microsoft.visualstudio.taco",
    // cordova-lib is technically what we want to given that is what cordova gives us when you "requre"
    // the node the "cordova" node module. However, the "cordova" and "cordova-lib" package version 
    // numbers do not match in CLI < v3.7.0. Ex: 3.6.3-0.2.13 does not match cordova-lib's version. 
    // If you need < v3.7.0, update this constant to "cordova".
    CORDOVA_LIB = "cordova-lib";


// Global vars
var cordovaCache = process.env["CORDOVA_CACHE"] || (process.platform === "darwin" || process.platform === "linux" ? path.join(process.env["HOME"],".cordova-cache") : path.join(process.env["APPDATA"], "cordova-cache")),
    defaultCordovaVersion = process.env["CORDOVA_DEFAULT_VERSION"] || DEFAULT_CORDOVA_VERSION,
    projectPath = process.cwd(),
    cordovaVersion,
    loadedCordovaVersion,
    cdv;

// Method to set options
function configure(obj) {
    if (obj.cordovaCache !== undefined) cordovaCache = obj.cordovaCache;
    if (obj.cordovaVersion !== undefined) cordovaVersion = obj.cordovaVersion;
    if (obj.projectPath !== undefined) projectPath = path.resolve(obj.projectPath);
    if(!fs.existsSync(projectPath)) {
        throw "Specified project path does not exist: \"" + projectPath + "\""
    }
}

// Gets and/or downloads the appropriate cordova node module for use based on options or taco.json
// Also installs support plugin if not already in the project
function setupCordova(obj) {
    if (obj !== undefined) {
        configure(obj);
    }

    // Check if Cordova already loaded
    if (cdv && cordovaVersion === loadedCordovaVersion) {
        return Q(cdv);
    }

    // If no version is set, try to get the version from taco.json
    if (cordovaVersion === undefined) {
        if (fs.existsSync(path.join(projectPath, "taco.json"))) {
            cordovaVersion = require(path.join(projectPath, "taco.json"))["cordova-cli"];
            console.log("Cordova version set to " + cordovaVersion + " based on the contents of taco.json");
        } else {
            cordovaVersion = defaultCordovaVersion;
            console.log("taco.json not found. Using default Cordova version of " + cordovaVersion);
        }
    }

    // Check if the specified version of Cordova is available in a local cache and install it if not 
    // Uses "CORDOVA_CACHE" environment variable or defaults of %APPDATA%\cordova-cache on windows and ~/.cordova-cache on OSX
    if (!fs.existsSync(cordovaCache)) {
        fs.mkdirSync(cordovaCache);
        console.log("Creating " + cordovaCache);
    }
    console.log("Cordova cache found at " + cordovaCache);

    // Install correct cordova version if not available
    var cordovaModulePath = path.resolve(path.join(cordovaCache, cordovaVersion));
    if (!fs.existsSync(cordovaModulePath)) {
        fs.mkdirSync(cordovaModulePath);
        fs.mkdirSync(path.join(cordovaModulePath, "node_modules"));
        console.log("Installing Cordova " + cordovaVersion + ".");

        return exec("npm install " + CORDOVA_LIB + "@" + cordovaVersion, { cwd: cordovaModulePath })
            .then(handleExecReturn).then(getCordova);
    } else {
        console.log("Cordova " + cordovaVersion + " already installed.");
        return getCordova();
    }
}

// Main build method
function buildProject(cordovaPlatforms, args) {
    if (typeof (cordovaPlatforms) == "string") {
        cordovaPlatforms = [cordovaPlatforms];
    }

    return setupCordova().then(function (cordova) {
        // Add platforms if not done already
        var promise = addPlatformsToProject(cordova, cordovaPlatforms);
        //Build each platform with args in args object
        cordovaPlatforms.forEach(function (platform) {
            promise = promise.then(function () {
                // Build app with platform specific args if specified
                var callArgs = getCallArgs(platform, args);
                console.log("Queueing build for platform " + platform + " w/options: " + callArgs.options || "none");
                return cordova.raw.build(callArgs);
            });
        });
        return promise;
    });
}

// Prep for build by adding platforms and setting environment variables
function addPlatformsToProject(cordova, cordovaPlatforms) {
    var promise = Q();
    cordovaPlatforms.forEach(function (platform) {
        if (!fs.existsSync(path.join(projectPath, "platforms", platform))) {
            console.log("Adding platform " + platform + "...");
            // Fix for when the plugins/<platform>.json file is accidently checked into source control 
            // without the corresponding contents of the platforms folder. This can cause the behavior
            // described here: http://stackoverflow.com/questions/30698118/tools-for-apache-cordova-installed-plugins-are-skipped-in-build 
            var platformPluginJsonFile = path.join(projectPath, "plugins", platform.trim() + ".json")
            if(fs.existsSync(platformPluginJsonFile)) {
                console.log(platform + ".json file found at \"" + platformPluginJsonFile + "\". Removing to ensure plugins install properly in newly added platform.")
                fs.unlinkSync(platformPluginJsonFile);
            }
            // Now add the platform
            promise = promise.then(function () { return cordova.raw.platform('add', platform); });
        } else {
            console.log("Platform " + platform + " already added.");
        }
    });
    return promise;
}

// Package project method - Just for iOS currently
function packageProject(cordovaPlatforms, args) {
    if (typeof (cordovaPlatforms) == "string") {
        cordovaPlatforms = [cordovaPlatforms];
    }

    return setupCordova().then(function (cordova) {
        var promise = Q(cordova);
        cordovaPlatforms.forEach(function (platform) {
            if (platform == "ios") {
                promise = promise.then(function() { return createIpa(args); });
            } else {
                console.log("Platform " + platform + " does not require a separate package step.");
            }
        });
        return promise;
    });
}

// Find the .app folder and use exec to call xcrun with the appropriate set of args
function createIpa(args) {
    var deferred = Q.defer();
    glob(projectPath + "/platforms/ios/build/device/*.app", function (err, matches) {
        if (err) {
            deferred.reject(err);
        } else {
            if (matches.length != 1) {
                throw "Expected only one .app - found " + matches.length;
            } else {
                var cmdString = "xcrun -sdk iphoneos PackageApplication \"" + matches[0] + "\" -o \"" +
                    path.join(path.dirname(matches[0]), path.basename(matches[0], ".app")) + ".ipa\" ";
                
                // Add additional command line args passed 
                var callArgs = getCallArgs("ios", args);
                callArgs.options.forEach(function (arg) {
                    cmdString += " " + arg;
                });

                console.log("Exec: " + cmdString);
                return exec(cmdString)
                    .then(handleExecReturn)
                    .fail(function(err) {
                        deferred.reject(err);
                    })
                    .done(function() {
                        deferred.resolve();
                    });
            }
        }
    });
    return deferred.promise;
}

// Utility method that "requires" the correct version of cordova-lib, adds in the support plugin if not present, sets CORDOVA_HOME 
function getCordova() {
    // Setup environment
    if (cdv === undefined || loadedCordovaVersion != cordovaVersion) {
        loadedCordovaVersion = cordovaVersion;
        process.chdir(projectPath);
        process.env["CORDOVA_HOME"] = path.join(cordovaCache,"_cordova"); // Set platforms to cache in cache locaiton to avoid unexpected results
        process.env["PLUGMAN_HOME"] = path.join(cordovaCache,"_plugman"); // Set plugin cache in cache locaiton to avoid unexpected results
        cdv = require(path.join(cordovaCache, cordovaVersion, "node_modules", CORDOVA_LIB));
        if(cdv.cordova) {
            cdv = cdv.cordova;
        }

        // Remove old version f support plugin if present. Add the new one if it's missing.
        if(fs.existsSync(path.join(projectPath, "plugins", OLD_SUPPORT_PLUGIN_ID))) {
            console.log("Removing old support plugin.");
            return cdv.raw.plugin("remove", OLD_SUPPORT_PLUGIN_ID).then(function() { return addSupportPlugin(cdv); });
        } else {
            return addSupportPlugin(cdv);
        }        
    } else {    
        return Q(cdv);
    }
}

// Utility method that adds the support plugin
function addSupportPlugin(cdv) {
    // Install VS support plugin if not already present
    if(!fs.existsSync(path.join(projectPath, "plugins", SUPPORT_PLUGIN_ID))) {
        console.log("Adding support plugin.");
        return cdv.raw.plugin("add", SUPPORT_PLUGIN).then(function() { return cdv; });
    } else {
        console.log("Support plugin already added.");
        return Q(cdv);
    }
}

// Utility method that coverts args into a consistant input understood by cordova-lib
function getCallArgs(platforms, args) {
    // Processes single platform string (or array of length 1) and an array of args or an object of args per platform
    args = args || [];
    if (typeof (platforms) == "string") {
        platforms = [platforms];
    }
    // If only one platform is specified, check if the args is an object and use the args for this platform if so
    if (platforms.length == 1) {
        if (args instanceof Array) {
            return { platforms: platforms, options: args };
        } else {
            return { platforms: platforms, options: args[platforms[0]] };
        }
    }
}

// Utility method to handle the return of exec calls - namely to send output to stdout / stderr
function handleExecReturn(result) {
    console.log("Exec complete.");
    console.log(result[0]);
    if (result[1] !== "") {
        console.error(result[1]);
    }
}

// Public methods
module.exports = {
    configure: configure,
    setupCordova: setupCordova,
    buildProject: buildProject,
    packageProject: packageProject
};
