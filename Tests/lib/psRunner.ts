/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
var shell = require('shelljs');
var exec = require('child_process').exec;

function debug(message) {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}

export function runPS(psPath: string, done) {
		var psr = new PSRunner(psPath);

		psr.run()
		.then(() => {
			done();
		})
		.fail((err) => {
			done(err);
		});	
}

export class PSRunner extends events.EventEmitter {
	constructor(psPath: string) {
		super();
		this._psPath = psPath;
	}
	
	public stderr: string;
	public stdout: string;

	private _psPath: string;
	
	//
	// stderr/out
	//

	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();

		if (!fs.existsSync(this._psPath)) {
			throw (new Error('Ps1 does not exist: ' + this._psPath));
		}
		
		var wd = path.dirname(this._psPath);
		
		var psPath = shell.which('powershell');	
		var cmdLine = psPath + ' -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$env:PSModulePath = [System.IO.Path]::Combine($env:windir, \'system32\\windowspowershell\\v1.0\\Modules\\\') ; Import-Module -Name ([System.IO.Path]::Combine($env:windir, \'system32\\windowspowershell\\v1.0\\Modules\\Microsoft.PowerShell.Management\\Microsoft.PowerShell.Management.psd1\')), ([System.IO.Path]::Combine($env:windir, \'system32\\windowspowershell\\v1.0\\Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1\')) ; Set-Content -LiteralPath variable:\VerbosePreference -Value [System.Management.Automation.ActionPreference]::Continue ; Set-Content -LiteralPath variable:\PSModuleAutoloadingPreference -Value "None" ; & \'' + this._psPath + '\'"';
		var child = exec(cmdLine, 
						{ 
							cwd: wd, 
							// keep current env clean
							env: process.env
						},
			(err, stdout, stderr) => {
				console.log('done');
				if (err !== null) {
					defer.reject(err);
					return;
				}

				if (stdout) {
					debug(stdout);
				}
				
				if (stderr) {
					debug('stderr:');
					debug(stderr);
				}
				
				defer.resolve(null);
			});
		
		return <Q.Promise<void>>defer.promise;
	}	
}

