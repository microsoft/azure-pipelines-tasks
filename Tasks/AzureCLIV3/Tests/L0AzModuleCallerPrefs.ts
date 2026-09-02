import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, 'L0AzModuleCallerPrefs_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'azurecli-wrapper-test-'));
const azPath = path.join(testRoot, 'wbin', 'az.cmd');
fs.mkdirSync(path.dirname(azPath), { recursive: true });
fs.writeFileSync(azPath, '@echo off\r\nexit /b 0\r\n');

process.env['AGENT_TEMPDIRECTORY'] = testRoot;
process.env['TEST_AZ_PROCESS_ROOT'] = testRoot;

tmr.setInput('powerShellErrorActionPreference', 'Stop');
tmr.setInput('inlineScript', `
$azCommand = Get-Command az -CommandType Function -ErrorAction Stop
Write-Host "COMMAND_METADATA_VALID:$([bool]($azCommand.Source -and $azCommand.Source -eq $azCommand.Path -and (Test-Path -LiteralPath $azCommand.Path)))"

$env:AZ_INSTALLER = 'OriginalInstaller'
az 'space value' 'special%^&'
Write-Host "ENV_RESTORED_AFTER_SUCCESS:$($env:AZ_INSTALLER -eq 'OriginalInstaller')"

if ($PSVersionTable.PSVersion.Major -ge 7) {
	function Invoke-AzFromCaller {
		$ErrorActionPreference = 'Stop'
		$PSNativeCommandUseErrorActionPreference = $true
		$PSNativeCommandArgumentPassing = 'Standard'
		Write-Host 'CALLER_FUNCTION_ENTERED:true'

		az '' 'quote"value'

		try {
			az fail
			az after-failure
			Write-Host 'FOLLOWING_NATIVE_COMMAND_RAN:true'
		}
		catch {
			Write-Host "NATIVE_EXCEPTION_TYPE:$($_.Exception.GetType().Name)"
			Write-Host 'FOLLOWING_NATIVE_COMMAND_RAN:false'
		}
	}

	Invoke-AzFromCaller
}
else {
	az 'windows-powershell'
	Write-Host "WINDOWS_POWERSHELL_EXIT_CODE:$LASTEXITCODE"
}

Write-Host "ENV_RESTORED_AFTER_FAILURE:$($env:AZ_INSTALLER -eq 'OriginalInstaller')"
$global:LASTEXITCODE = 0
`);
tmr.setInput('scriptPath', '');
tmr.setInput('powerShellIgnoreLASTEXITCODE', 'false');

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
	'which': {
		'az': azPath
	},
	'checkPath': {
		[azPath]: true
	}
};
tmr.setAnswers(answers);
tmr.run();
