$ExecutePsScript = {
    Param(
        [string] $scriptPath,
        [string] $scriptArguments,
        [string] $inlineScript,
        [switch] $inline,
        [string] $workingDirectory,
        [string] $_errorActionPreference,
        [switch] $ignoreLASTEXITCODE,
        [switch] $failOnStdErr
    )

    function Invoke-Tool {
        Param(
            [string] $toolPath,
            [string] $toolArgs
        )
        Invoke-Expression "& '$($toolPath.Replace('"', '').Replace("'", "''"))' $($toolArgs.Trim())"
    }

    try {

        if( $inline -eq $true ) {
            $tempScriptPath = [System.IO.Path]::Combine(([System.IO.Path]::GetTempPath()), ([guid]::NewGuid().ToString() + ".ps1"));
            $scriptPath = $tempScriptPath
            $scriptArguments = ""
            ($inlineScript | Out-File $scriptPath)
        }

        if(!([string]::IsNullOrEmpty($workingDirectory)) -and !(Test-Path -Path $workingDirectory -PathType Container)) {
            throw [System.IO.DirectoryNotFoundException]::New($workingDirectory)
        }

        if(!(Test-Path -Path $scriptPath -PathType Leaf)) {
            throw [System.IO.FileNotFoundException]::New($scriptPath)
        }

        $script = [scriptblock]::Create("
            try {
                pushd .
                if(![string]::IsNullOrEmpty(`"$workingDirectory`")) {
                    cd '$($workingDirectory.Replace("'","''"))'
                }
                `$ErrorActionPreference = `"$_errorActionPreference`"
                & '$($_scriptPath.Replace("'","''"))' $($_scriptArguments.Trim())
                if(`"$ignoreLASTEXITCODE`" -eq `$false) {
                    if(!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {
                        Write-Output `"LASTEXITCODE is not set`"
                    } else {
                        Write-Output `"LASTEXITCODE is `$LASTEXITCODE`"
                        exit `$LASTEXITCODE
                    }
                }
            } finally {
                popd
            }
        ");

        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
        $powershellArguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command { $script }"
        
        Invoke-Tool -toolPath $powershellPath -toolArgs $powershellArguments 2>&1 |
            ForEach-Object {
                ,$_
                if($_ -is [System.Management.Automation.ErrorRecord] -and $failOnStdErr -eq $true) {
                    "##vso[task.complete result=Failed]"
                }
            }
       
    } finally {
        if((Test-Path -LiteralPath $tempScriptPath -PathType Leaf) -eq $true) {
            Remove-Item -Path $tempScriptPath -Force
        }
    }
}

