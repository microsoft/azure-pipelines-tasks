function Assert-SingleItem
{
    [CmdletBinding()]
    Param
    (
        $Items,

        [String]
        $Pattern
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if (@($Items).Length -gt 1) 
        {
            throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern) 
        }
        elseif ($Items -eq $null -or @($Items).Length -eq 0)
        {
            throw (Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern) 
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}