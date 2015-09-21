/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
var fs, path;

module.exports = function(context) {
    
    // Skip processing if being called from within Visual Studio
    if (!process.env["VisualStudioEdition"]) {
        fs = require('fs');
        path = require('path');

        context.opts.cordova.platforms.forEach(function(platform) {
            console.log("Processing res/native for " + platform);
            var resNative = path.join(process.cwd(), "res", "native", platform);
            if (fs.existsSync(resNative)) {
                copyFiles(resNative, path.join(process.cwd(), "platforms", platform));
            }
        });            
    }

    // Recusive copy function for res/native processing
    function copyFiles(srcPath, destPath) {
        if (fs.statSync(srcPath).isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath);
            }
            fs.readdirSync(srcPath).forEach(function (child) {
                copyFiles(path.join(srcPath, child), path.join(destPath, child));
            });
        } else {
            fs.writeFileSync(destPath, fs.readFileSync(srcPath));
        }
    }   
};

