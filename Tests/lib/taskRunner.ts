/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
var exec = require('child_process').exec;
var shell = require('shelljs');
var tl = require('vso-task-lib');

function debug(message) {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}

export class TaskRunner extends events.EventEmitter {
	constructor(name: string) {
		super();
		this._inputs = {};
		this._name = name;
		this._taskEnv = {};
		this.succeeded = false;
		this.failed = false;
		this.resultWasSet = false;
		this.invokedToolCount = 0;
		this.stderr = '';
		this._tempPath = process.env['TASK_TEST_TEMP'];
	}
	
	public succeeded: boolean;
	public failed: boolean;
	public resultWasSet: boolean;
	public invokedToolCount: number;
	public stderr: string;
	public stdout: string;

	private _name: string;
	private _inputs: any;
	private _task: any;
	private _taskEnv: any;
	private _taskSrcPath: string;
	private _taskPath: string;
	private _tempPath: string;

	public registerTool(name: string, toolPath: string): void {
		var toolVar = 'TASK_TEST_WHICH_' + name.toUpperCase();
		this._taskEnv[toolVar] = toolPath;
	}

	public injectFailure() {
		this._taskEnv['TASK_TEST_FAIL'] = 1;
	}

	public injectReturnCode(rc: number) {
		this._taskEnv['TASK_TEST_RC'] = rc;
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
		console.log('strErrContained? ' + this.stderr.indexOf(text));
		return this.stderr.indexOf(text) >= 0;
	}

	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();

		if (!this._tempPath) {
			throw (new Error('Temp is not defined'));
		}

		this._taskSrcPath = path.join(__dirname, '..', '..', 'Tasks', this._name);
		
		if (!fs.existsSync(this._taskSrcPath)) {
			throw (new Error('Did you build with "gulp"? Task does not exist: ' + this._taskSrcPath));
		}
		
		// copy mocked vso-task-lib if it doesn't exist
		var modPath = path.join(this._tempPath, 'node_modules');
		if (!shell.test('-d', modPath)) {
			shell.mkdir('-p', modPath);
			shell.cp('-R', path.join(__dirname, 'vso-task-lib'), path.join(modPath));			
		}

		// copy the task over so we can execute from Temp 
		// this forces it to use the mocked vso-task-lib and provides isolation
		this._taskPath = path.join(this._tempPath, this._name);
		if (!shell.test('-d', this._taskPath)) {
			shell.mkdir('-p', this._taskPath);
			shell.cp('-R', this._taskSrcPath, this._tempPath);
		}

		var jsonPath = path.join(this._taskPath, 'task.json');
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
		.fin(() => {
			// cleanup
		})
		
		return <Q.Promise<void>>defer.promise;
	}
	

	private _processOutput(stdout: string, stderr: string) {
		this.stderr = stderr || '';

		var stdoutLines: string[] = [];
		if (stdout) {
			stdoutLines = stdout.split('\n');
		}

		stdoutLines.forEach((line: string) => {
			if (line.indexOf('[command]') >= 0) {
				++this.invokedToolCount;
			}

			if (line.indexOf('##vso[') >= 0) {
				var cmd = tl.commandFromString(line);
				//console.log(JSON.stringify(cmd, null, 2));

  				if (cmd.command === "task.complete") {
  					if (cmd.properties.result === 'Failed') {
  						this.failed = true;
  						this.resultWasSet = true;
  					}
  					else if (cmd.properties.result === 'Succeeded') {
  						this.succeeded = true;
  						this.resultWasSet = true;
  					}
  				}
			}
		})
	}

	private _tryRunNode(): Q.Promise<void> {
		var defer = Q.defer<void>();

		//
		// Match node handler logic in agent.  The vars is the protocol
		//
	    var env = process.env;
	    for (var key in this._inputs){
	        var envVarName = 'INPUT_' + key.replace(' ', '_').toUpperCase();
	        this._taskEnv[envVarName] = this._inputs[key];
	    }

	    //
	    // Run the task via node
	    //
		var nodeExecution = this._task.execution['Node'];
		if (nodeExecution) {
			if (!nodeExecution.target) {
				throw (new Error('Execution target not specified'));
			}

			var scriptPath = path.join(this._taskPath, nodeExecution.target);
			if (!shell.test('-f', scriptPath)) {
				throw (new Error('target does not exist: ' + scriptPath));
			}

			var child = exec('node ' + scriptPath, 
							{ 
								cwd: this._taskPath, 
								// keep current env clean
								env: this._taskEnv
							},
				(err, stdout, stderr) => {
					if (err !== null) {
						defer.reject(err);
						return;
					}

					this._processOutput(stdout, stderr);

					if (stdout) {
						debug(stdout);
					}
					
					if (stderr) {
						debug('stderr:');
						debug(stderr);
					}
					
					defer.resolve(null);
				});
		}
		else {
			defer.resolve(null);
		}		
		
		return <Q.Promise<void>>defer.promise;
	}	
}

