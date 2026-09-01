import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const testScript = path.join(os.tmpdir(), 'az_callerprefs_test.ps1');

const scriptContent = `
$ErrorActionPreference = 'Stop'

$m = New-Module -Name 'TestAzCallerPrefs' -ScriptBlock {
    function az {
        $callerFrame = (Get-PSCallStack)[1].GetFrameVariables()
        $eapFrame = $callerFrame['ErrorActionPreference']
        if ($eapFrame) { $ErrorActionPreference = $eapFrame.Value }
        $nativeFrame = $callerFrame['PSNativeCommandUseErrorActionPreference']
        if ($nativeFrame) { $PSNativeCommandUseErrorActionPreference = $nativeFrame.Value }
        $argFrame = $callerFrame['PSNativeCommandArgumentPassing']
        if ($argFrame) { $PSNativeCommandArgumentPassing = $argFrame.Value }

        & cmd /c "exit 1"
        $global:LASTEXITCODE = $LASTEXITCODE
    }
    Export-ModuleMember -Function az
}
Import-Module -ModuleInfo $m -Global -Force

# Verify module metadata
$cmd = Get-Command az -CommandType Function
Write-Host "AZ_COMMAND_TYPE:$($cmd.CommandType)"
Write-Host "AZ_SOURCE:$($cmd.Source)"

# Test: with PSNativeCommandUseErrorActionPreference, a failed az should throw
$PSNativeCommandUseErrorActionPreference = $true
try {
    az
    Write-Host "SECOND_COMMAND_RAN:true"
} catch {
    Write-Host "NATIVE_EXCEPTION_CAUGHT:true"
    Write-Host "SECOND_COMMAND_RAN:false"
    Write-Host "EXCEPTION_TYPE:$($_.Exception.GetType().Name)"
}
`;

fs.writeFileSync(testScript, scriptContent, { encoding: 'utf8' });

try {
    const result = child_process.execSync(
        `pwsh -NoProfile -NonInteractive -File "${testScript}"`,
        { encoding: 'utf8', timeout: 15000 }
    );
    console.log(result);
} catch (err: any) {
    // pwsh may exit nonzero if the script throws — stdout still has our markers
    console.log(err.stdout || '');
    if (err.stderr) { console.log('PWSH_STDERR:' + err.stderr); }
} finally {
    try { fs.unlinkSync(testScript); } catch (_) {}
}
