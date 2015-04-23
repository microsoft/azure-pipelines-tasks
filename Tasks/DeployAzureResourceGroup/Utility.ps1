function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw "Found more than one file to deploy with search pattern $pattern. There can be only one."
    }
    else
    {
        if (!$files)
        {
            throw "No files were found to deploy with search pattern $pattern"
        }

        return $files
    }
}

function Get-File($pattern)
{
    #Find the File based on pattern
    Write-Host "Find-Files -SearchPattern $pattern"
    $filesMatchingPattern = Find-Files -SearchPattern "$pattern"
    Write-Host "Files Matching Pattern = $filesMatchingPattern" -ForegroundColor Yellow
    #Ensure that at most a single file is found
    $file = Get-SingleFile $filesMatchingPattern $pattern

    return $file
}