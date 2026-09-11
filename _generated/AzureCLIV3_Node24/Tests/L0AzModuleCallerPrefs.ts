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
fs.writeFileSync(azPath, '@echo off\r\necho STOCK_AZ_EXECUTED:%*\r\nexit /b 0\r\n');

process.env['AGENT_TEMPDIRECTORY'] = testRoot;
process.env['TEST_AZ_PROCESS_ROOT'] = testRoot;

tmr.setInput('powerShellErrorActionPreference', 'Stop');
tmr.setInput('inlineScript', `
$azCommand = Get-Command az -CommandType Alias -ErrorAction Stop
Write-Host "COMMAND_METADATA_VALID:$([bool]($azCommand.Source -and $azCommand.Source -eq $azCommand.Path -and $azCommand.Source -eq $azCommand.Definition -and (Test-Path -LiteralPath $azCommand.Path)))"
$capturedAzSource = $azCommand.Source
& $capturedAzSource source-execution
Write-Host "CAPTURED_SOURCE_EXECUTED:$($LASTEXITCODE -eq 0)"

$env:AZ_INSTALLER = 'OriginalInstaller'
az 'space value' 'special%^&'
Write-Host "ENV_RESTORED_AFTER_SUCCESS:$($env:AZ_INSTALLER -eq 'OriginalInstaller')"

if ($PSVersionTable.PSVersion.Major -ge 7) {
	function Invoke-AzFromInnerCaller {
		Write-Host 'INNER_CALLER_ENTERED:true'
		az '' 'quote"value'
		az fail
		az after-failure
	}

	function Invoke-AzFromOuterCaller {
		$ErrorActionPreference = 'Stop'
		$PSNativeCommandUseErrorActionPreference = $true
		$PSNativeCommandArgumentPassing = 'Standard'
		Write-Host 'OUTER_CALLER_ENTERED:true'

		try {
			Invoke-AzFromInnerCaller
			Write-Host 'FOLLOWING_NATIVE_COMMAND_RAN:true'
		}
		catch {
			Write-Host "NATIVE_EXCEPTION_TYPE:$($_.Exception.GetType().Name)"
			Write-Host 'FOLLOWING_NATIVE_COMMAND_RAN:false'
			Write-Host "ENV_RESTORED_AFTER_NATIVE_EXCEPTION:$($env:AZ_INSTALLER -eq 'OriginalInstaller')"
		}
	}

	Invoke-AzFromOuterCaller
}

$ErrorActionPreference = 'Continue'
if ($PSVersionTable.PSVersion.Major -ge 7) {
	$PSNativeCommandUseErrorActionPreference = $false
}
$env:AZ_INSTALLER = 'BeforeNonzero'
az fail
$nonzeroSuccess = $?
$nonzeroExitCode = $LASTEXITCODE
Write-Host "NONZERO_SUCCESS:$nonzeroSuccess"
Write-Host "NONZERO_EXIT_CODE:$nonzeroExitCode"
Write-Host "ENV_RESTORED_AFTER_NONZERO:$($env:AZ_INSTALLER -eq 'BeforeNonzero')"

$env:AZ_INSTALLER = ''
$emptyInstallerExistedBefore = Test-Path Env:\AZ_INSTALLER
az empty-installer
$emptyInstallerExistedAfter = Test-Path Env:\AZ_INSTALLER
Write-Host "ENV_EMPTY_STATE_RESTORED:$($emptyInstallerExistedAfter -eq $emptyInstallerExistedBefore -and ($null -eq $env:AZ_INSTALLER) -eq (-not $emptyInstallerExistedBefore) -and (!$emptyInstallerExistedAfter -or $env:AZ_INSTALLER -eq ''))"

function Get-PSCallStack { throw 'customer Get-PSCallStack must not run' }
function Remove-Item { throw 'customer Remove-Item must not run' }
Microsoft.PowerShell.Management\\Remove-Item Env:\AZ_INSTALLER -ErrorAction SilentlyContinue
az shadowed-builtins
Write-Host "SHADOWED_BUILTINS_SUCCESS:$?"
Write-Host "ENV_ABSENT_AFTER_SHADOWED_SUCCESS:$($null -eq $env:AZ_INSTALLER)"

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
