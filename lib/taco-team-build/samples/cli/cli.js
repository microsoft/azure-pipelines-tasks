#!/usr/bin/env node
/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

var cordovaBuild = require('../taco-team-build.js'),
    cordovaPlatform = process.argv[2],
    buildArgs = process.argv.slice(3);

cordovaBuild.buildProject(cordovaPlatform, buildArgs)
    .then(function() { return cordovaBuild.packageProject(cordovaPlatform); })
    .fail(function (err) {
        console.error(err);
        process.exit(1);
    }).done();