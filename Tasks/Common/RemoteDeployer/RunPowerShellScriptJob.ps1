$ExecutePsScript = {
    Param(
        [string] $scriptPath,
        [string] $scriptArguments = "",
        [string] $inlineScript,
        [bool] $inline,
        [string] $workingDirectory = "",
        [string] $_errorActionPreference = "Continue",
        [bool] $ignoreLASTEXITCODE,
        [bool] $failOnStdErr,
        [string] $initializationScriptPath,
        [string] $sessionVariables
    )

    $Global:ErrorActionPreference = "Continue";

    function Invoke-Tool {
        Param(
            [string] $toolPath,
            [string] $toolArgs
        )
        $command = "& '$($toolPath.Replace('"', '').Replace("'", "''"))' $($toolArgs.Trim())"
        Write-Host "##[command]$command"
        Invoke-Expression $command
    }

    function Create-TemporaryFile {
        Param(
            [string] $contents
        )
        $filePath = [System.IO.Path]::Combine(([System.IO.Path]::GetTempPath()), ([guid]::NewGuid().ToString() + ".ps1"));
        [System.IO.File]::WriteAllText(
            $filePath,
            $contents,
            [System.Text.Encoding]::UTF8
        )
        return $filePath
    }
    
    function Remove-TemporaryFile {
        Param(
            [string] $filePath
        )
        if(![string]::IsNullOrEmpty($filePath) -and ((Test-Path -LiteralPath $filePath -PathType Leaf) -eq $true)) {
            Remove-Item -Path $filePath -Force -ErrorAction "SilentlyContinue"
        }
    }

    try {

        $result = @{
            "VstsTaskJobResult" = $true;
            "Status" = "InProgress";
            "Message" = "PS_TM_ExitCode";
            "ExitCode" = -1;
            "ComputerName" = $env:COMPUTERNAME
        }

        if( $inline -eq $true ) {
            $inlineScript = [scriptblock]::Create($inlineScript)
            $inlineScriptPath = Create-TemporaryFile -contents $inlineScript
            $scriptPath = $inlineScriptPath
        }

        if(!([string]::IsNullOrEmpty($workingDirectory)) -and !(Test-Path -Path $workingDirectory -PathType Container)) {
            throw "DirectoryNotFound: $workingDirectory"
        }

        if([string]::IsNullOrEmpty($scriptPath) -or !(Test-Path -Path $scriptPath -PathType Leaf)) {
            throw "FileNotFound: $scriptPath"
        }

        if(![string]::IsNullOrEmpty($initializationScriptPath) -and !(Test-Path -LiteralPath $initializationScriptPath -PathType Leaf)) {
            throw [System.IO.FileNotFoundException]::New($initializationScriptPath);
        }

        $script = [scriptblock]::Create("
            `$ErrorActionPreference = 'Stop'
            cd '$($workingDirectory.Replace("'","''"))'
            $sessionVariables
            `$ErrorActionPreference = `"$_errorActionPreference`"

            if(![string]::IsNullOrEmpty(`"$initializationScriptPath`")) {
                . '$($initializationScriptPath.Replace("'","''"))'
            }

            `$VerbosePreference = `"Continue`"
            . '$($scriptPath.Replace("'","''"))' $($scriptArguments.Trim())

            if(`"$ignoreLASTEXITCODE`" -eq `$false) {
                if(!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {
                    Write-Output `"##vso[task.debug][`$env:ComputerName]LASTEXITCODE is not set`"
                } else {
                    Write-Output `"##vso[task.debug][`$env:ComputerName]LASTEXITCODE is `$LASTEXITCODE`"
                    exit `$LASTEXITCODE
                }
            }
        ");

        $tempScriptPath = Create-TemporaryFile -contents $script
        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
        $powershellArguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `". '$($tempScriptPath.Replace("'", "''"))'`""

        Invoke-Tool -toolPath $powershellPath -toolArgs $powershellArguments *>&1 |
            ForEach-Object {
                ,$_
                if($_ -is [System.Management.Automation.ErrorRecord] -and $failOnStdErr -eq $true) {
                    "##vso[task.complete result=Failed]"
                }
            }
        $result.Status = "Passed";   
    } catch {
        $result.Status = "Failed";
        $result.Message = "$($_.Exception.Message)"
    } finally {
        Remove-TemporaryFile -filePath $inlineScriptPath
        Remove-TemporaryFile -filePath $tempScriptPath
        $result.ExitCode = $LASTEXITCODE
    }

    return $result
}