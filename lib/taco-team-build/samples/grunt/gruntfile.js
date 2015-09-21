/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
module.exports = function (grunt) {

    grunt.loadNpmTasks("grunt-typescript");

    grunt.initConfig({
        typescript: {
            base: {
                src: "scripts/**/*.ts",
                dest: "www",
                options: {
                    base: "scripts",
                    noImplicitAny: false,
                    noEmitOnError: true,
                    removeComments: false,
                    sourceMap: true,
                    target: "es5"
                }
            }
        }
    });

    grunt.registerTask('default', ['typescript', 'build']);

    grunt.registerTask('build', function () {
        var cordovaBuild = require('taco-team-build'),
            done = this.async();

        var winPlatforms = ["android", "windows", "wp8"],
            linuxPlatforms = ["android"],
            osxPlatforms = ["ios"],
            platformsToBuild = process.platform === "darwin" ? osxPlatforms :
                (process.platform === "linux" ? linuxPlatforms : winPlatforms), // Darwin == OSX
            buildArgs = {
                android: ["--release", "--device", "--gradleArg=--no-daemon"],   // Warning: Omit the extra "--" when referencing platform
                ios: ["--release", "--device"],                                 // specific preferences like "-- --ant" for Android
                windows: ["--release", "--device"],                             // or "-- --win" for Windows. You may also encounter a
                wp8: ["--release", "--device"]                                  // "TypeError" after adding a flag Android doesn't recognize
            };                                                                  // when using Cordova < 4.3.0. This is fixed in 4.3.0.

        cordovaBuild.buildProject(platformsToBuild, buildArgs)
            .then(function () {
                return cordovaBuild.packageProject(platformsToBuild);
            })
            .done(done);
    });
};

