$ExecutePsScript = {
    Param(
        [string] $scriptPath,
        [string] $scriptArguments = "",
        [string] $inlineScript,
        [switch] $inline,
        [string] $workingDirectory = "",
        [string] $_errorActionPreference = "Continue",
        [switch] $ignoreLASTEXITCODE,
        [switch] $failOnStdErr
    )

    $Global:ErrorActionPreference = "Continue";

    function Invoke-Tool {
        Param(
            [string] $toolPath,
            [string] $toolArgs
        )
        Invoke-Expression "& '$($toolPath.Replace('"', '').Replace("'", "''"))' $($toolArgs.Trim())"
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
            "VstsTask" = $true;
            "Status" = "Failed";
            "Message" = "PS_TM_ExitCode";
            "ExitCode" = 0;
        }

        if( $inline -eq $true ) {
            $inlineScriptPath = [System.IO.Path]::Combine(([System.IO.Path]::GetTempPath()), ([guid]::NewGuid().ToString() + ".ps1"));
            $scriptPath = $inlineScriptPath
            $scriptArguments = ""
            ($inlineScript | Out-File $scriptPath)
        }

        if(!([string]::IsNullOrEmpty($workingDirectory)) -and !(Test-Path -Path $workingDirectory -PathType Container)) {
            throw [System.IO.DirectoryNotFoundException]::New($workingDirectory)
        }

        if([string]::IsNullOrEmpty($scriptPath) -or !(Test-Path -Path $scriptPath -PathType Leaf)) {
            throw [System.IO.FileNotFoundException]::New($scriptPath)
        }

        $script = [scriptblock]::Create("
            try {
                Push-Location .
                if(![string]::IsNullOrEmpty(`"$workingDirectory`")) {
                    cd '$($workingDirectory.Replace("'","''"))'
                }
                `$ErrorActionPreference = `"$_errorActionPreference`"
                & '$($scriptPath.Replace("'","''"))' $($scriptArguments.Trim())
            } finally {
                Pop-Location
                if(`"$ignoreLASTEXITCODE`" -eq `$false) {
                    if(!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {
                        Write-Output `"LASTEXITCODE is not set`"
                    } else {
                        Write-Output `"LASTEXITCODE is `$LASTEXITCODE`"
                        exit `$LASTEXITCODE
                    }
                }
            }
        ");

        $tempScriptPath = [System.IO.Path]::Combine(([System.IO.Path]::GetTempPath()), ([guid]::NewGuid().ToString() + ".ps1"));
        $script | Out-File $tempScriptPath

        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
        $powershellArguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `". '$($tempScriptPath.Replace("'", "''"))'`""

        Invoke-Tool -toolPath $powershellPath -toolArgs $powershellArguments 2>&1 |
            ForEach-Object {
                $_
                if($_ -is [System.Management.Automation.ErrorRecord] -and $failOnStdErr -eq $true) {
                    "##vso[task.complete result=Failed]"
                }
            }
        $result.Status = "Passed";            
    } catch {
        $result.Status = "Failed";
        $result.Message = "$($_.Exception.Message)"
        throw
    } finally {
        Remove-TemporaryFile -filePath $inlineScriptPath
        Remove-TemporaryFile -filePath $tempScriptPath
        $result.ExitCode = $LASTEXITCODE
    }

    return $result
}