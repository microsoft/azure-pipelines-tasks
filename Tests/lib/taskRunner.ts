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

		this.succeeded = false;
		this.failed = false;
		this.resultWasSet = false;
		this.invokedToolCount = 0;
		this.stdErrLineCount = 0;

		this._tempPath = process.env['TASK_TEST_TEMP'];
	}
	
	public succeeded: boolean;
	public failed: boolean;
	public resultWasSet: boolean;
	public invokedToolCount: number;
	public stdErrLineCount: number;

	private _name: string;
	private _inputs: any;
	private _task: any;
	private _stdErrLines: string[];
	private _tempPath: string;

	public registerTool(name: string, toolPath: string): void {

	}

	public injectFailure() {
		process.env['TASK_TEST_FAIL'] = 1;
	}

	public ran(cmdLine: string): boolean {
		return true;
	}

	public setInput(name: string, val: string) {
		this._inputs[name] = val;
	}
	
	//
	// stderr/out
	//
	public stdErrContained(text: string): boolean {
		var did: boolean = false;

		this._stdErrLines.some((line: string) => {
			did = line.indexOf(text) > 0;
			return did;
		})

		return did;
	}

	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();

		if (!this._tempPath) {
			throw (new Error('Temp is not defined'));
		}

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
		
		// copy mocked vso-task-lib if it doesn't exist
		var modPath = path.join(this._tempPath, 'node_modules');
		if (!shell.test('-d', modPath)) {
			shell.mkdir('-p', modPath);
			shell.cp('-R', path.join(__dirname, 'vso-task-lib'), path.join(modPath));			
		}

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

