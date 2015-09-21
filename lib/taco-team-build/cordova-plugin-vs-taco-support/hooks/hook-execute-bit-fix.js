/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
var fs = require("fs");
var path = require("path");
var exec = require("child_process").exec;
var Q;

module.exports = function(context) {
  // Only bother if we're on OSX and are after platform add for iOS itself (still need to run for other platforms)
  if(process.platform =="darwin" && 
      context.opts && 
      context.opts.cordova && 
      context.opts.cordova.platforms && 
      !(context.hook == "before_platform_add" && context.opts.platforms.indexOf("ios") >= 0)) {

    // Grab the Q, glob node modules from cordova
    Q=context.requireCordovaModule("q");
    // Need to return a promise since glob is async
    var deferred = Q.defer();

    // Generate the script to set execute bits for installed platforms
    var script ="";
    context.opts.cordova.platforms.forEach(function(platform) {
      script += "find -E platforms/" + platform + "/cordova -type f -regex \"[^.(LICENSE)]*\" -exec chmod +x {} +\n"
    });
    
    // Run script
    exec(script, function(err, stderr, stdout) {
      if(err) deferred.reject(err);
      if(stderr) console.error(stderr);
      if(stdout) console.log(stdout);
      deferred.resolve();
    });
    
    return deferred.promise;
  }
}
