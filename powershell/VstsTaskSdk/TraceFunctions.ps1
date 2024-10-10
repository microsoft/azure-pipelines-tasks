<#
.SYNOPSIS
Writes verbose information about the invocation being entered.

.DESCRIPTION
Used to trace verbose information when entering a function/script. Writes an entering message followed by a short description of the invocation. Additionally each bound parameter and unbound argument is also traced.

.PARAMETER Parameter
Wildcard pattern to control which bound parameters are traced.
#>
function Trace-EnteringInvocation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.InvocationInfo]$InvocationInfo,
        [string[]]$Parameter = '*')

    Write-Verbose "Entering $(Get-InvocationDescription $InvocationInfo)."
    $OFS = ", "
    if ($InvocationInfo.BoundParameters.Count -and $Parameter.Count) {
        if ($Parameter.Count -eq 1 -and $Parameter[0] -eq '*') {
            # Trace all parameters.
            foreach ($key in $InvocationInfo.BoundParameters.Keys) {
                Write-Verbose " $($key): '$($InvocationInfo.BoundParameters[$key])'"
            }
        } else {
            # Trace matching parameters.
            foreach ($key in $InvocationInfo.BoundParameters.Keys) {
                foreach ($p in $Parameter) {
                    if ($key -like $p) {
                        Write-Verbose " $($key): '$($InvocationInfo.BoundParameters[$key])'"
                        break
                    }
                }
            }
        }
    }

    # Trace all unbound arguments.
    if (@($InvocationInfo.UnboundArguments).Count) {
        for ($i = 0 ; $i -lt $InvocationInfo.UnboundArguments.Count ; $i++) {
            Write-Verbose " args[$i]: '$($InvocationInfo.UnboundArguments[$i])'"
        }
    }
}

<#
.SYNOPSIS
Writes verbose information about the invocation being left.

.DESCRIPTION
Used to trace verbose information when leaving a function/script. Writes a leaving message followed by a short description of the invocation.
#>
function Trace-LeavingInvocation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.InvocationInfo]$InvocationInfo)

    Write-Verbose "Leaving $(Get-InvocationDescription $InvocationInfo)."
}

<#
.SYNOPSIS
Writes verbose information about paths.

.DESCRIPTION
Writes verbose information about the paths. The paths are sorted and a the common root is written only once, followed by each relative path.

.PARAMETER PassThru
Indicates whether to return the sorted paths.
#>
function Trace-Path {
    [CmdletBinding()]
    param(
        [string[]]$Path,
        [switch]$PassThru)

    if ($Path.Count -eq 0) {
        Write-Verbose "No paths."
        if ($PassThru) {
            $Path
        }
    } elseif ($Path.Count -eq 1) {
        Write-Verbose "Path: $($Path[0])"
        if ($PassThru) {
            $Path
        }
    } else {
        # Find the greatest common root.
        $sorted = $Path | Sort-Object
        $firstPath = $sorted[0].ToCharArray()
        $lastPath = $sorted[-1].ToCharArray()
        $commonEndIndex = 0
        $j = if ($firstPath.Length -lt $lastPath.Length) { $firstPath.Length } else { $lastPath.Length }
        for ($i = 0 ; $i -lt $j ; $i++) {
            if ($firstPath[$i] -eq $lastPath[$i]) {
                if ($firstPath[$i] -eq '\') {
                    $commonEndIndex = $i
                }
            } else {
                break
            }
        }

        if ($commonEndIndex -eq 0) {
            # No common root.
            Write-Verbose "Paths:"
            foreach ($p in $sorted) {
                Write-Verbose " $p"
            }
        } else {
            Write-Verbose "Paths: $($Path[0].Substring(0, $commonEndIndex + 1))"
            foreach ($p in $sorted) {
                Write-Verbose " $($p.Substring($commonEndIndex + 1))"
            }
        }

        if ($PassThru) {
            $sorted
        }
    }
}

########################################
# Private functions.
########################################
function Get-InvocationDescription {
    [CmdletBinding()]
    param([System.Management.Automation.InvocationInfo]$InvocationInfo)

    if ($InvocationInfo.MyCommand.Path) {
        $InvocationInfo.MyCommand.Path
    } elseif ($InvocationInfo.MyCommand.Name) {
        $InvocationInfo.MyCommand.Name
    } else {
        $InvocationInfo.MyCommand.CommandType
    }
}
