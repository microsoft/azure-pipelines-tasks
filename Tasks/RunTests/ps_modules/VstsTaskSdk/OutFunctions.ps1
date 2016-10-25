# TODO: It would be better if the Out-Default function resolved the underlying Out-Default
# command in the begin block. This would allow for supporting other modules that override
# Out-Default.
$script:outDefaultCmdlet = $ExecutionContext.InvokeCommand.GetCmdlet("Microsoft.PowerShell.Core\Out-Default")

########################################
# Public functions.
########################################
function Out-Default {
    [CmdletBinding(ConfirmImpact = "Medium")]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [System.Management.Automation.PSObject]$InputObject)

    begin {
        #Write-Host '[Entering Begin Out-Default]'
        $__sp = { & $script:outDefaultCmdlet @PSBoundParameters }.GetSteppablePipeline()
        $__sp.Begin($pscmdlet)
        #Write-Host '[Leaving Begin Out-Default]'
    }

    process {
        #Write-Host '[Entering Process Out-Default]'
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            Write-Verbose -Message 'Error record:' 4>&1 | Out-Default
            Write-Verbose -Message (Remove-TrailingNewLine (Out-String -InputObject $_ -Width 2147483647)) 4>&1 | Out-Default
            Write-Verbose -Message 'Script stack trace:' 4>&1 | Out-Default
            Write-Verbose -Message "$($_.ScriptStackTrace)" 4>&1 | Out-Default
            Write-Verbose -Message 'Exception:' 4>&1 | Out-Default
            Write-Verbose -Message $_.Exception.ToString() 4>&1 | Out-Default
            Write-TaskError -Message $_.Exception.Message
        } elseif ($_ -is [System.Management.Automation.WarningRecord]) {
            Write-TaskWarning -Message (Remove-TrailingNewLine (Out-String -InputObject $_ -Width 2147483647))
        } elseif ($_ -is [System.Management.Automation.VerboseRecord]) {
            foreach ($private:str in (Format-DebugMessage -Object $_)) {
                Write-TaskVerbose -Message $private:str
            }
        } elseif ($_ -is [System.Management.Automation.DebugRecord]) {
            foreach ($private:str in (Format-DebugMessage -Object $_)) {
                Write-TaskDebug -Message $private:str
            }
        } else {
# TODO: Consider using out-string here to control the width. As a security precaution it would actually be best to set it to max so wrapping doesn't interfere with secret masking.
            $__sp.Process($_)
        }

        #Write-Host '[Leaving Process Out-Default]'
    }

    end {
        #Write-Host '[Entering End Out-Default]'
        $__sp.End()
        #Write-Host '[Leaving End Out-Default]'
    }
}

########################################
# Private functions.
########################################
function Format-DebugMessage {
    [CmdletBinding()]
    param([psobject]$Object)

    $private:str = Out-String -InputObject $Object -Width 2147483647
    $private:str = Remove-TrailingNewLine $private:str
    "$private:str".Replace("`r`n", "`n").Replace("`r", "`n").Split("`n"[0])
}

function Remove-TrailingNewLine {
    [CmdletBinding()]
    param($Str)
    if ([object]::ReferenceEquals($Str, $null)) {
        return $Str
    } elseif ($Str.EndsWith("`r`n")) {
        return $Str.Substring(0, $Str.Length - 2)
    } else  {
        return $Str
    }
}
