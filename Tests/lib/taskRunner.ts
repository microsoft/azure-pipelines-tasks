/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
var shell = require('shelljs');

export class TaskRunner extends events.EventEmitter {
	constructor(taskPath: string) {
		super();
		this._inputs = {};
		this._taskPath = taskPath;
	}
	
	private _taskPath: string;
	private _inputs: any;
	private _task: any;
	
	public setInput(name: string, val: string) {
		this._inputs[name] = val;
	}
	
	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();
		
		if (!fs.existsSync(this._taskPath)) {
			throw (new Error('Did you build with "gulp"? Task does not exist: ' + this._taskPath));
		}
		
		var jsonPath = path.join(this._taskPath, 'task.json');
		if (!fs.existsSync(jsonPath)) {
			throw (new Error('Task json does not exist: ' + jsonPath));
		}
		
		var json = fs.readFileSync(jsonPath).toString();
		this._task = JSON.parse(json);
		
		this._tryRunNode()
		.then(() => {
			return this._tryRunPS();	
		})
		.then(() => {
			this.emit('completed');
			defer.resolve(null);
		})
		.fail((err) => {
			defer.reject(err);
		})
		
		return <Q.Promise<void>>defer.promise;
	}
	
	private _tryRunNode(): Q.Promise<void> {
		var defer = Q.defer<void>();
		
		var nodeExecution = this._task.execution['Node'];
		if (nodeExecution) {
			setTimeout(() => {
				console.log('Running: ' + nodeExecution.target);
				defer.resolve(null);				
			}, 10);			
		}
		else {
			defer.resolve(null);
		}		
		
		return <Q.Promise<void>>defer.promise;
	}
	
	private _tryRunPS(): Q.Promise<void> {
		var defer = Q.defer<void>();
		
		var psExecution = this._task.execution['PowerShell'];
		//console.log(JSON.stringify(psExecution, null, 2));
		
		if (psExecution) {
			//console.log(psExecution.target);
			setTimeout(() => {
				console.log('Running: ' + psExecution.target);
				defer.resolve(null);				
			}, 10);			
		}
		else {
			defer.resolve(null);
		}
		
		return <Q.Promise<void>>defer.promise;
	}	
}

