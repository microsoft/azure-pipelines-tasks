// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var jake = require('jake');
var args = process.argv.slice(2);

jake.addListener('complete', function () {
	console.log('Complete.');
});

jake.addListener('start', function () {
	console.log('start.');
});

jake.addListener('error', function (msg, code) {
    console.error('Fatal error: ', msg, code);
});

jake.run.apply(jake, args);
