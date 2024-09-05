########################################
# Private functions.
########################################
function ConvertFrom-LongFormPath {
    [CmdletBinding()]
    param([string]$Path)

    if ($Path) {
        if ($Path.StartsWith('\\?\UNC')) {
            # E.g. \\?\UNC\server\share -> \\server\share
            return $Path.Substring(1, '\?\UNC'.Length)
        } elseif ($Path.StartsWith('\\?\')) {
            # E.g. \\?\C:\directory -> C:\directory
            return $Path.Substring('\\?\'.Length)
        }
    }

    return $Path
}
function ConvertTo-LongFormPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    [string]$longFormPath = Get-FullNormalizedPath -Path $Path
    if ($longFormPath -and !$longFormPath.StartsWith('\\?')) {
        if ($longFormPath.StartsWith('\\')) {
            # E.g. \\server\share -> \\?\UNC\server\share
            return "\\?\UNC$($longFormPath.Substring(1))"
        } else {
            # E.g. C:\directory -> \\?\C:\directory
            return "\\?\$longFormPath"
        }
    }

    return $longFormPath
}

# TODO: ADD A SWITCH TO EXCLUDE FILES, A SWITCH TO EXCLUDE DIRECTORIES, AND A SWITCH NOT TO FOLLOW REPARSE POINTS.
function Get-DirectoryChildItem {
    [CmdletBinding()]
    param(
        [string]$Path,
        [ValidateNotNullOrEmpty()]
        [Parameter()]
        [string]$Filter = "*",
        [switch]$Force,
        [VstsTaskSdk.FS.FindFlags]$Flags = [VstsTaskSdk.FS.FindFlags]::LargeFetch,
        [VstsTaskSdk.FS.FindInfoLevel]$InfoLevel = [VstsTaskSdk.FS.FindInfoLevel]::Basic,
        [switch]$Recurse)

    $stackOfDirectoryQueues = New-Object System.Collections.Stack
    while ($true) {
        $directoryQueue = New-Object System.Collections.Queue
        $fileQueue = New-Object System.Collections.Queue
        $findData = New-Object VstsTaskSdk.FS.FindData
        $longFormPath = (ConvertTo-LongFormPath $Path)
        $handle = $null
        try {
            $handle = [VstsTaskSdk.FS.NativeMethods]::FindFirstFileEx(
                [System.IO.Path]::Combine($longFormPath, $Filter),
                $InfoLevel,
                $findData,
                [VstsTaskSdk.FS.FindSearchOps]::NameMatch,
                [System.IntPtr]::Zero,
                $Flags)
            if (!$handle.IsInvalid) {
                while ($true) {
                    if ($findData.fileName -notin '.', '..') {
                        $attributes = [VstsTaskSdk.FS.Attributes]$findData.fileAttributes
                        # If the item is hidden, check if $Force is specified.
                        if ($Force -or !$attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                            # Create the item.
                            $item = New-Object -TypeName psobject -Property @{
                                'Attributes' = $attributes
                                'FullName' = (ConvertFrom-LongFormPath -Path ([System.IO.Path]::Combine($Path, $findData.fileName)))
                                'Name' = $findData.fileName
                            }
                            # Output directories immediately.
                            if ($item.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                                $item
                                # Append to the directory queue if recursive and default filter.
                                if ($Recurse -and $Filter -eq '*') {
                                    $directoryQueue.Enqueue($item)
                                }
                            } else {
                                # Hold the files until all directories have been output.
                                $fileQueue.Enqueue($item)
                            }
                        }
                    }

                    if (!([VstsTaskSdk.FS.NativeMethods]::FindNextFile($handle, $findData))) { break }

                    if ($handle.IsInvalid) {
                        throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                            [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
                            Get-LocString -Key PSLIB_EnumeratingSubdirectoriesFailedForPath0 -ArgumentList $Path
                        ))
                    }
                }
            }
        } finally {
            if ($handle -ne $null) { $handle.Dispose() }
        }

        # If recursive and non-default filter, queue child directories.
        if ($Recurse -and $Filter -ne '*') {
            $findData = New-Object VstsTaskSdk.FS.FindData
            $handle = $null
            try {
                $handle = [VstsTaskSdk.FS.NativeMethods]::FindFirstFileEx(
                    [System.IO.Path]::Combine($longFormPath, '*'),
                    [VstsTaskSdk.FS.FindInfoLevel]::Basic,
                    $findData,
                    [VstsTaskSdk.FS.FindSearchOps]::NameMatch,
                    [System.IntPtr]::Zero,
                    $Flags)
                if (!$handle.IsInvalid) {
                    while ($true) {
                        if ($findData.fileName -notin '.', '..') {
                            $attributes = [VstsTaskSdk.FS.Attributes]$findData.fileAttributes
                            # If the item is hidden, check if $Force is specified.
                            if ($Force -or !$attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                                # Collect directories only.
                                if ($attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                                    # Create the item.
                                    $item = New-Object -TypeName psobject -Property @{
                                        'Attributes' = $attributes
                                        'FullName' = (ConvertFrom-LongFormPath -Path ([System.IO.Path]::Combine($Path, $findData.fileName)))
                                        'Name' = $findData.fileName
                                    }
                                    $directoryQueue.Enqueue($item)
                                }
                            }
                        }

                        if (!([VstsTaskSdk.FS.NativeMethods]::FindNextFile($handle, $findData))) { break }

                        if ($handle.IsInvalid) {
                            throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                                [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
                                Get-LocString -Key PSLIB_EnumeratingSubdirectoriesFailedForPath0 -ArgumentList $Path
                            ))
                        }
                    }
                }
            } finally {
                if ($handle -ne $null) { $handle.Dispose() }
            }
        }

        # Output the files.
        $fileQueue

        # Push the directory queue onto the stack if any directories were found.
        if ($directoryQueue.Count) { $stackOfDirectoryQueues.Push($directoryQueue) }

        # Break out of the loop if no more directory queues to process.
        if (!$stackOfDirectoryQueues.Count) { break }

        # Get the next path.
        $directoryQueue = $stackOfDirectoryQueues.Peek()
        $Path = $directoryQueue.Dequeue().FullName

        # Pop the directory queue if it's empty.
        if (!$directoryQueue.Count) { $null = $stackOfDirectoryQueues.Pop() }
    }
}

function Get-FullNormalizedPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    [string]$outPath = $Path
    [uint32]$bufferSize = [VstsTaskSdk.FS.NativeMethods]::GetFullPathName($Path, 0, $null, $null)
    [int]$lastWin32Error = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($bufferSize -gt 0) {
        $absolutePath = New-Object System.Text.StringBuilder([int]$bufferSize)
        [uint32]$length = [VstsTaskSdk.FS.NativeMethods]::GetFullPathName($Path, $bufferSize, $absolutePath, $null)
        $lastWin32Error = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($length -gt 0) {
            $outPath = $absolutePath.ToString()
        } else  {
            throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                $lastWin32Error
                Get-LocString -Key PSLIB_PathLengthNotReturnedFor0 -ArgumentList $Path
            ))
        }
    } else {
        throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
            $lastWin32Error
            Get-LocString -Key PSLIB_PathLengthNotReturnedFor0 -ArgumentList $Path
        ))
    }

    if ($outPath.EndsWith('\') -and !$outPath.EndsWith(':\')) {
        $outPath = $outPath.TrimEnd('\')
    }

    $outPath
}