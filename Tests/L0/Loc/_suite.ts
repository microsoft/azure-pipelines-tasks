/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import fs = require('fs');
import querystring = require('querystring');

describe('Loc String Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('Find invalid message key in task.json', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
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
			
			var locStringsFromJson = {};
			var existCount = 0;
			if(task.hasOwnProperty('messages')) {
				for(var key in task.messages) {
					if(key.search(/\W+/gi) >= 0) {
						var taskName = path.relative(tasksRootFolder, taskjson);
						assert(false, ('messages key: \'' + key +'\' contain non-word characters, only allows [a-zA-Z0-9_].'));
					}
        		}
			}
		}
		
		done();
	})
	
	it('Find missing string in .js', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
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
				
				var jsFiles = fs.readdirSync(taskFolder).filter(file => {
					return file.search(/\.js$/) > 0;
				})
				
				var locStrings = {};
				jsFiles.forEach(jsFile => {
					var js = fs.readFileSync(path.join(taskFolder, jsFile)).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
					var lines: string[] = js.split('\n');
					lines.forEach(line => {
						var patt = /tl\.loc\('\w+\b' *, *'.+'\)/gi;
						var res = patt.exec(line);
						if(res) {
							var locCall = res[0];
							locCall = locCall.substr(0, locCall.length - 1).replace(/tl\.loc\('/i, '');
							var key = locCall.substr(0, locCall.indexOf('\''));
							locCall = locCall.substr(locCall.indexOf('\'') + 1 ).trim();
							locCall = locCall.substr(locCall.indexOf(',') + 1 ).trim();
							var defaultStr = locCall.substr(1, locCall.length - 2);
							locStrings[key] = defaultStr.replace(/\\'/g, '\'');
						}	
					});
				})
				
				var locStringsFromJson = {};
				var existCount = 0;
				if(task.hasOwnProperty('messages')) {
					for(var key in task.messages) {
            			locStringsFromJson[key] = task.messages[key];
						existCount++;
        			}
				}
				
				var updatedLocStrings = {};
				var updatedCount = 0;
				for(var locKey in locStrings) {
					if(!locStringsFromJson.hasOwnProperty(locKey) || locStringsFromJson[locKey] !== locStrings[locKey]) {
						locStringMismatch = true;
					}
					updatedLocStrings[locKey] = locStrings[locKey];
					updatedCount++;
				}
				
				if(existCount > updatedCount) {
					locStringMismatch = true;
				}
				
				if(locStringMismatch) {
					testFailed = true;
					console.error('update messages section for task: ' + path.relative(tasksRootFolder, taskjson));
					console.error(JSON.stringify(updatedLocStrings));
				}
				
				
			}
			else {
				//console.info('Skip task without .js implementation.');
			}
		}
		
		assert(!testFailed, 'there are missing loc strings in task.json.');
		
		done();
	})
});
