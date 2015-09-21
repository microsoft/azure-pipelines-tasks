/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/
var gulp = require("gulp"),
    fs = require("fs"),
    ts = require("gulp-typescript"),
    cordovaBuild = require("taco-team-build");

var winPlatforms = ["android", "windows", "wp8"],
    linuxPlatforms = ["android"],
    osxPlatforms = ["ios"],
    buildArgs = {
        android: ["--release","--device","--gradleArg=--no-daemon"],                // Warning: Omit the extra "--" when referencing platform
        ios: ["--release", "--device"],                                             // specific preferences like "-- --ant" for Android
        windows: ["--release", "--device"],                                         // or "-- --win" for Windows. You may also encounter a
        wp8: ["--release", "--device"]                                              // "TypeError" after adding a flag Android doesn't recognize
    },                                                                              // when using Cordova < 4.3.0. This is fixed in 4.3.0.
    platformsToBuild = process.platform === "darwin" ? osxPlatforms :
                       (process.platform === "linux" ? linuxPlatforms : winPlatforms),  // "Darwin" is the platform name returned for OSX. 
    tsconfigPath = "scripts/tsconfig.json";                                             // This could be extended to include Linux as well.

gulp.task("default", ["package"], function () {
    // Copy results to bin folder
    gulp.src("platforms/android/ant-build/*.apk").pipe(gulp.dest("bin/release/android"));   // Ant build
    gulp.src("platforms/android/bin/*.apk").pipe(gulp.dest("bin/release/android"));         // Gradle build
    gulp.src("platforms/windows/AppPackages/**/*").pipe(gulp.dest("bin/release/windows/AppPackages"));
    gulp.src("platforms/wp8/bin/Release/*.xap").pipe(gulp.dest("bin/release/wp8"));
    gulp.src("platforms/ios/build/device/*.ipa").pipe(gulp.dest("bin/release/ios"));
});

gulp.task("scripts", function () {
    // Compile TypeScript code - This sample is designed to compile anything under the "scripts" folder using settings
    // in scripts/tsconfig.json if present or this gulpfile if not.  Adjust as appropriate for your use case.
    if (fs.existsSync(tsconfigPath)) {
        // Use settings from scripts/tsconfig.json
        gulp.src("scripts/**/*.ts")
            .pipe(ts(ts.createProject(tsconfigPath)))
            .pipe(gulp.dest("."));
    } else {
        // Otherwise use these default settings
         gulp.src("scripts/**/*.ts")
            .pipe(ts({
                noImplicitAny: false,
                noEmitOnError: true,
                removeComments: false,
                sourceMap: true,
                out: "appBundle.js",
            target: "es5"
            }))
            .pipe(gulp.dest("www/scripts"));        
    }
});

gulp.task("build", ["scripts"], function () {
    return cordovaBuild.buildProject(platformsToBuild, buildArgs);
});

gulp.task("build-win", ["scripts"], function() {
    return cordovaBuild.buildProject("windows", buildArgs);
});

gulp.task("build-wp8", ["scripts"], function() {
    return cordovaBuild.buildProject("wp8", buildArgs);
});

gulp.task("build-android", ["scripts"], function() {
    return cordovaBuild.buildProject("android", buildArgs);
});

gulp.task("build-ios", ["scripts"], function() {
    return cordovaBuild.buildProject("ios", buildArgs);
});

gulp.task("package", ["build"], function () {
    return cordovaBuild.packageProject(platformsToBuild);
});

// Example of running the app on an attached device.
// Type "gulp run-ios" to execute. Note that ios-deploy will need to be installed globally.
gulp.task("run-ios", ["scripts"], function (callback) {
    cordovaBuild.setupCordova().done(function (cordova) {
        cordova.run({ platforms: ["ios"], options: ["--debug", "--device"] }, callback);
    });
});

// Example of running app on the iOS simulator
// Type "gulp sim-ios" to execute. Note that ios-sim will need to be installed globally.
gulp.task("sim-ios", ["scripts"], function (callback) {
    cordovaBuild.setupCordova().done(function (cordova) {
        cordova.emulate({ platforms: ["ios"], options: ["--debug"] }, callback);
    });
});
