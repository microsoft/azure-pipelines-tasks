/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import fs = require('fs');

describe('Loc String Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('Find invalid task.json', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				taskFolders.push(path.join(tasksRootFolder, folderName));	
			}
		})

		for(var i = 0; i < taskFolders.length; i++) {
			var taskFolder = taskFolders[i];

			var taskjson = path.join(taskFolder, 'task.json');
			var jsonString = fs.readFileSync(taskjson).toString();
			if(jsonString.indexOf('\uFEFF') >= 0) {
				console.warn('the JSON has a \'Zero Width No-Break Space\', this may cause JSON parse failed.');
				console.warn('try to remove all zero-width characters, this may generated pending changes, you need to check them in.');
				var fixedJsonString = jsonString.replace(/[\uFEFF]/g, '');
				fs.writeFileSync(taskjson, fixedJsonString);
				assert(false, 'need check-in \'U+FEFF\' fix for: ' + taskjson);
			}
			try
			{
				var task = JSON.parse(fs.readFileSync(taskjson).toString());
			}
			catch(err)
			{
				assert(false, err.message + '\n\tunable to parse JSON from: ' + taskjson);				
			}
		}
		
		done();
	})
	
    it('Find .js with uppercase', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				taskFolders.push(path.join(tasksRootFolder, folderName));	
			}
		})

		for(var i = 0; i < taskFolders.length; i++) {
			var taskFolder = taskFolders[i];

			var taskjson = path.join(taskFolder, 'task.json');
            var task = require(taskjson);
            
            if (task.execution['Node']) {
				
				var tsFiles = fs.readdirSync(taskFolder).filter(file => {
					return file.search(/\.ts$/) > 0;
				})
				
				tsFiles.forEach(tsFile => {
                    if(tsFile.search(/[A-Z]/g) >= 0) {
                        console.error('Has uppercase in .ts file name for tasks: ' + path.relative(tasksRootFolder, taskjson));
                        assert(false, 'Has uppercase is dangerous for xplat tasks.' + taskjson);
                    }
				})
				
                var targetJs = task.execution['Node'].target;
                if(targetJs.search(/[A-Z]/g) >= 0) {
                    console.error('Has uppercase in task.json\'s excution.node.target for tasks: ' + path.relative(tasksRootFolder, taskjson));
                    assert(false, 'Has uppercase is dangerous for xplat tasks.' + taskjson);
                }
			}
		}
		
		done();
	})
    
	it('Find invalid message key in task.json', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				taskFolders.push(path.join(tasksRootFolder, folderName));	
			}
		})

		for(var i = 0; i < taskFolders.length; i++) {
			var taskFolder = taskFolders[i];

			var taskjson = path.join(taskFolder, 'task.json');
			var task = require(taskjson);

			if(task.hasOwnProperty('messages')) {
				for(var key in task.messages) {
					var taskName = path.relative(tasksRootFolder, taskjson);
					
					assert(key.search(/\W+/gi) < 0, ('(' + taskName +')' + 'messages key: \'' + key +'\' contain non-word characters, only allows [a-zA-Z0-9_].'));
					if(typeof(task.messages[key]) === 'object') {
						assert(task.messages[key].loc, ('(' + taskName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(task.messages[key].loc.toString().length >= 0, ('(' + taskName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(task.messages[key].fallback, ('(' + taskName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
						assert(task.messages[key].fallback.toString().length > 0, ('(' + taskName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
					}
					else if(typeof(task.messages[key]) === 'string') {
						assert(task.messages[key].toString().length > 0, ('(' + taskName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
					} 
        		}
			}
		}
		
		done();
	})
	
	it('Find missing string in .ts', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName => {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				taskFolders.push(path.join(tasksRootFolder, folderName));	
			}
		})
		
		var testFailed: boolean = false;
		
		for(var i = 0; i < taskFolders.length; i++) {
			var locStringMismatch: boolean = false;
			var taskFolder = taskFolders[i];
			
			var taskjson = path.join(taskFolder, 'task.json');
			var task = require(taskjson);
			
			if (task.execution['Node']) {
				
				var tsFiles = fs.readdirSync(taskFolder).filter(file => {
					return file.search(/\.ts$/) > 0;
				})
				
				var locStringKeys: string[] = [];
				tsFiles.forEach(tsFile => {
					var ts = fs.readFileSync(path.join(taskFolder, tsFile)).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
					var lines: string[] = ts.split('\n');
					lines.forEach(line => {
						// remove all spaces.
						line = line.replace(/ /g, '');
						
						var regx = /tl\.loc\(('(\w+)'|"(\w+)")/i;
						var res = regx.exec(line);
						if(res) {
							var key;
							if(res[2]) {
								key = res[2];
							}
							else if(res[3]) {
								key = res[3];
							}

							locStringKeys.push(key);
						}	
					});
				})
				
				var locStringKeysFromJson: string[] = [];
				if(task.hasOwnProperty('messages')) {
					for(var key in task.messages) {
            			locStringKeysFromJson.push(key);
        			}
				}
				
				var missingLocStringKeys: string[] = [];
				locStringKeys.forEach(locKey => {
					if(locStringKeysFromJson.indexOf(locKey) === -1) {
						locStringMismatch = true;
						missingLocStringKeys.push(locKey);
					}
				})
				
				if(locStringMismatch) {
					testFailed = true;
					console.error('add missing loc string keys to messages section for task: ' + path.relative(tasksRootFolder, taskjson));
					console.error(JSON.stringify(missingLocStringKeys));
				}
			}
			else {
				//console.info('Skip task without .js implementation.');
			}
		}
		
		assert(!testFailed, 'there are missing loc string keys in task.json.');
		
		done();
	})
});
