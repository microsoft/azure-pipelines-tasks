function Get-PackageFiles ($Path)
{
    Find-VstsFiles -LiteralDirectory $Path -LegacyPattern "**" -Force |
        ForEach-Object { $_.ToLower() } |
        Sort-Object
}

function Find-FileChanges
{
    [CmdletBinding()]
    [OutputType([bool])]
    Param
    (
        [Parameter(Mandatory = $true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $NewPackageRoot,

        [Parameter(Mandatory = $true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $OldPackageRoot,

        [string]
        $LogIndent,

        [Switch]
        $LogAllChanges
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $LogIndent += "".PadLeft(2)

        if (Find-VstsFiles -LiteralDirectory $NewPackageRoot -LegacyPattern "**\*.pdb" -Force)
        {
            Write-Warning (Get-VstsLocString -Key PdbWarning)
        }

        $newFilesQueue = [System.Collections.Queue] @(Get-PackageFiles $NewPackageRoot)
        $oldFilesQueue = [System.Collections.Queue] @(Get-PackageFiles $OldPackageRoot)

        $result = $false

        # Search for changes while both queues have at least one file
        while ($oldFilesQueue.Count -gt 0 -and $newFilesQueue.Count -gt 0)
        {
            $newFile = $newFilesQueue.Peek()
            $oldFile = $oldFilesQueue.Peek()

            $newRelativePath = $newFile.Substring($NewPackageRoot.Length + 1)
            $oldRelativePath = $oldFile.Substring($OldPackageRoot.Length + 1)

            if ($oldRelativePath -lt $newRelativePath)
            {
                Write-Host "$LogIndent$(Get-VstsLocString -Key FileRemoved -ArgumentList $oldRelativePath)"
                $result = $true
                $oldFilesQueue.Dequeue() | Out-Null
            }
            elseif ($oldRelativePath -gt $newRelativePath)
            {
                Write-Host "$LogIndent$(Get-VstsLocString -Key FileAdded -ArgumentList $newRelativePath)"
                $result = $true
                $newFilesQueue.Dequeue() | Out-Null
            }
            else
            {
                if (!(Test-FileEqual $newFile $oldFile))
                {
                    Write-Host "$LogIndent$(Get-VstsLocString -Key FileChanged -ArgumentList $newRelativePath)"
                    $result = $true
                }

                $newFilesQueue.Dequeue() | Out-Null
                $oldFilesQueue.Dequeue() | Out-Null
            }

            if ($result -and !$LogAllChanges)
            {
                # Break on the first change if the user doesn't want to log all changes
                return $result
            }
        }

        # If one of the queues still has files, then we know they are 'added' or 'removed' files and we can simply iterate through them.

        while ($oldFilesQueue.Count -gt 0)
        {
            $oldRelativePath = $oldFilesQueue.Dequeue().Substring($OldPackageRoot.Length + 1)
            Write-Host "$LogIndent$(Get-VstsLocString -Key FileRemoved -ArgumentList $oldRelativePath)"
            $result = $true

            if (!$LogAllChanges)
            {
                return $result
            }
        }

        while ($newFilesQueue.Count -gt 0)
        {
            $newRelativePath = $newFilesQueue.Dequeue().Substring($NewPackageRoot.Length + 1)
            Write-Host "$LogIndent$(Get-VstsLocString -Key FileAdded -ArgumentList $newRelativePath)"
            $result = $true

            if (!$LogAllChanges)
            {
                return $result
            }
        }

        $result
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

Export-ModuleMember -Function Find-FileChanges