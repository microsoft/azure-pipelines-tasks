function Get-LinestoAppend
{
    param
    (
        [string]$line
    )

    $line = $line.Trim()
    $length = $line.Length
    $commentsIndex = $line.IndexOf("--")

    #Don't split if entire line is a comment
    if ($commentsIndex -eq 0)
    {
        return $line, $null
    }

    #Split if the line has only GO
    if ($line -contains "GO")
    {
        $lineArr = $line -split "GO", 2
        return $lineArr[0], $lineArr[1]
    }

    #Split if line starts with GO
    #This avoids 'select * from goair join table2' even though there is matching pattern 'go '
    if ($length -ge 3)
    {
        $lineSubstring = $line.Substring(0, 3)
        if ($lineSubstring -match "GO ")
        {
            $lineArr = $line -split "GO ", 2
            return $lineArr[0], $lineArr[1]
        }
    }
    
    #Split line if it has a GO in between like 'select * from table GO create procedure'
    $goIndex = $line.IndexOf(" GO ", [System.StringComparison]::CurrentCultureIgnoreCase)
    if (($commentsIndex -ne -1) -and ($goIndex -ne -1) -and ($commentsIndex -lt $goIndex))
    {
        return $line, $null
    }
    if ($goIndex -ge 0)
    {
        $lineArr = $line -split " GO ", 2
        return $lineArr[0], $lineArr[1]
    }

    #Split if line ends with GO
    #This avoids 'select * from indigo' even if there is a matching pattern ending with 'go'
    $lastCharsIndex = [int]$length - 3
    if (($commentsIndex -ne -1) -and ($lastCharsIndex -ge 0) -and ($commentsIndex -lt $lastCharsIndex))
    {
        return $line, $null
    }
    if ($length -ge 3)
    {
        $lineSubstring = $line.Substring($lastCharsIndex, 3)
        if ($lineSubstring -match " GO")
        {
            return $line.Substring(0, [int]$length - 3), ''
        }
    }
       
    #Send the line as is       
    return $line, $null
}

function Test-IsSplitRequired
{
    param
    (
        [string]$line
    )


    $lineUntilGo, $lineAfterGo = Get-LinestoAppend -line $line

    #LineAfterGo is present only if the line can be split.
    if ($lineAfterGo -eq $null) 
    {
        return $false
    }

    return $true
}

function Write-BatchFile
{
    param
    (
        [string]$fileName,
        [string]$line,
        [boolean]$newBatch,
        [string]$filesCreated
    )
    
    Add-Content -path $fileName -value $line

    if ($newBatch -eq $true)
    {
        $filesCreated = $filesCreated + $fileName + "; "
    }

    $newBatch = $false

    return $newBatch, $filesCreated
}

function Get-NewBatchFileName
{
   param
    (
        [string]$destPath,
        [string]$batch,
        [string]$batchIndex,
        [string]$sqlFileName,
        [string]$ext
    )
    
    $fileName = "{0}\{1}.{2}.{3}.{4}" -f ($destPath, $batch, $batchIndex, $sqlFileName, $ext)
    return $fileName
}

function Create-BatchFilesForSqlFile 
{
    param
    (
        [string]$sqlFilePath,
        [string]$destPath,
        [string]$batch
    )
    
    $batchIndex = 1
    $sqlFileName = (Get-Item -Path $sqlFilePath).BaseName
    $reader = new-object System.IO.StreamReader($sqlFilePath)  
    $ext = "sql"
    $batchFileName = Get-NewBatchFileName -destPath $destPath -batch $batch -batchIndex $batchIndex -sqlFileName $sqlFileName -ext $ext

    #Split files
    $filesCreated = ""
    $newBatch = $true
    while(($line = $reader.ReadLine()) -ne $null)
    {
        $lineToSplit = $line
        while ([string]::IsNullOrEmpty($lineToSplit) -eq $false)
        {
            if ((Test-IsSplitRequired -line $lineToSplit) -eq $false)
            {
                $newBatch, $filesCreated = Write-BatchFile -fileName $batchFileName -line $lineToSplit -newBatch $newBatch -filesCreated $filesCreated
                break
            }

            $lineUntilGo, $lineAfterGo = Get-LinestoAppend($lineToSplit)
            if ([string]::IsNullOrEmpty($lineUntilGo) -eq $false)
            {
                $newBatch, $filesCreated = Write-BatchFile -fileName $batchFileName -line $lineUntilGo -newBatch $newBatch -filesCreated $filesCreated
            }

            $batchIndex = [int]$batchIndex + 1
            $batchFileName = Get-NewBatchFileName -destPath $destPath -batch $batch -batchIndex $batchIndex -sqlFileName $sqlFileName -ext $ext
            $newBatch = $true
            $lineToSplit = $lineAfterGo
        }
    }

    $reader.Close()
    return $filesCreated
}


   