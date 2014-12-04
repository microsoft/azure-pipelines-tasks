// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

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
