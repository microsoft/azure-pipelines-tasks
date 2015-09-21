/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
var fs = require("fs"),
    path = require("path");

module.exports = function(context) {
    
    if(context.opts && context.opts.cordova && context.opts.cordova.platforms) {
        var projectPath = context.opts.projectRoot;
    
        context.opts.cordova.platforms.forEach(function (platform) {
            if (!fs.existsSync(path.join(projectPath, "platforms", platform))) {
                // Fix for when the plugins/<platform>.json file is accidently checked into source control 
                // without the corresponding contents of the platforms folder. This can cause the behavior
                // described here: http://stackoverflow.com/questions/30698118/tools-for-apache-cordova-installed-plugins-are-skipped-in-build 
                var platformPluginJsonFile = path.join(projectPath, "plugins", platform.trim() + ".json");
                if(fs.existsSync(platformPluginJsonFile)) {
                    console.log(platform + ".json file found at \"" + platformPluginJsonFile + "\". Removing to ensure plugins install properly in newly added platform.");
                    fs.unlinkSync(platformPluginJsonFile);
                }
            }
        });   
    }
}
