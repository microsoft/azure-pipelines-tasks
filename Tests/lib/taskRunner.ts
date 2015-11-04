/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
var shell = require('shelljs');

export class TaskRunner extends events.EventEmitter {
	constructor(name: string) {
		super();
		this._inputs = {};
		this._name = name;
	}
	
	private _name: string;
	private _inputs: any;
	private _task: any;
	
	public setInput(name: string, val: string) {
		this._inputs[name] = val;
	}
	
	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();

		var taskPath = path.join(__dirname, '..', '..', 'Tasks', this._name);
		
		if (!fs.existsSync(taskPath)) {
			throw (new Error('Did you build with "gulp"? Task does not exist: ' + taskPath));
		}
		
		var jsonPath = path.join(taskPath, 'task.json');
		if (!fs.existsSync(jsonPath)) {
			throw (new Error('Task json does not exist: ' + jsonPath));
		}
		
		var json = fs.readFileSync(jsonPath).toString();
		this._task = JSON.parse(json);
		
		this._tryRunNode()
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
}

