$ProjectGuidAndFilePathMap = @{}
$ComponentKeyAndPathMap = @{}
$ComponentKeyAndRelativePathCache = @{}


#region Public

#
# Fetches the new issues from the json report and also adds a "relativePath" for easier consumption
#
# Remark: the SonarQube report uses the component guid to refer to paths
#
function FetchAnnotatedNewIssues
{    
    $sonarReportFilePath = GetSonarReportFilePath
    if (![System.IO.File]::Exists($sonarReportFilePath))
    {
        throw "Could not find the SonarQube issue report at $sonarReportFilePath. Unable to post issues to the PR."
    }

    Write-Verbose "Report file found at $sonarReportFilePath"    
        
    CreateProjectGuidAndPathMap    
    
    $sonarReportFilePath = GetSonarReportFilePath
    $json = DeserializeReport $sonarReportFilePath
    ConstructComponentKeyAndPathMap $json

    # '@' makes sure the result set is returned as an array
    $newIssues = @($json.issues | Where {$_.isNew -eq $true})
    Write-Host "Found $($json.issues.Count) issues out of which $($newIssues.Count) are new"

    if ($($newIssues.Count) -gt 0)
    {
        foreach ($issue in $newIssues)
        {
            $filePath = GetRelativeFilePath $($issue.component)

            # Add a new property in the object which stores the file path so it can be consumed directly
            Add-Member -InputObject $issue -MemberType NoteProperty -Name "relativePath" -Value $filePath
        }
    }

    return $newIssues
}

#endregion

#region Private

#
# Returns the path to the file containing the issues that SonarQube generates when ran in issues / incremental mode
#
function GetSonarReportFilePath
{ 
    $sonarReportFolderPath = GetSonarScannerDirectory
    $sonarReportFilePath = [System.IO.Path]::Combine($sonarReportFolderPath, "sonar-report.json")

    return $sonarReportFilePath
}

function DeserializeReport
{
    param ([ValidateNotNullOrEmpty()][string]$sonarReportFilePath)
    
    Add-Type -AssemblyName "System.Web.Extensions"
    
    # Read sonar-report.json file as a json object
    $sonarReportFileContent = Get-Content -Raw $sonarReportFilePath
    $jsonSer = New-Object -TypeName System.Web.Script.Serialization.JavaScriptSerializer
    
    # Default value of MaxJsonLength is 2,097,152. Increasing max length by a factor of 10 to handle bigger file sizes
    $jsonSer.MaxJsonLength = 2097152 * 10
    $json = $jsonSer.DeserializeObject($sonarReportFileContent)   
    
    return $json 
}

function ConstructComponentKeyAndPathMap($json)
{
    foreach ($component in $json.components)
    {
        if (!$ComponentKeyAndPathMap.ContainsKey($component.key))
        {
            $ComponentKeyAndPathMap.Add($component.key, $component.path)
        }
    }
}

# Creates a mapping of msbuild project guid and the path of .xxproj file on disk using ProjectInfo.xml file
function CreateProjectGuidAndPathMap
{        
    $parentFolder = GetSonarQubeOutDirectory
    $parentFolderItem = Get-Item $parentFolder
    $directories = $parentFolderItem.GetDirectories()

    foreach ($directory in $directories)
    {
        $projectInfoFilePath = [System.IO.Path]::Combine($directory.FullName, "ProjectInfo.xml")
        
        if ([System.IO.File]::Exists($projectInfoFilePath))
        {
            Write-Verbose "CreateProjectGuidAndPathMap: Processing project info file: $projectInfoFilePath"
            [xml]$xmlContent = Get-Content $projectInfoFilePath

            if ($xmlContent -and !$ProjectGuidAndFilePathMap.ContainsKey($xmlContent.ProjectInfo.ProjectGuid))
            {
                $ProjectGuidAndFilePathMap.Add($xmlContent.ProjectInfo.ProjectGuid, $xmlContent.ProjectInfo.FullPath)
            }
        }
    }
}

function IsComponentFormatValid($tokens)
{
    #expected format for component '[SonarQube project key]:[SonarQube project value]:[MSBuild project guid]:[file name relative to MSBuild project file path]'

    if (!$tokens)
    {
        Write-Verbose "IsComponentFormatValid: tokens is invalid"
        return $false
    }
    
    if ($tokens.Count -ne 4) 
    {
        Write-Verbose "IsComponentFormatValid: component is not in expected format, token count is not equal to 4"
        return $false
    }

    #third token must be a guid
    $guidToken = $tokens[2]

    $outGuid = New-Object -TypeName "System.Guid"
    if (![System.Guid]::TryParse($guidToken, [ref]$outGuid))
    {
        Write-Verbose "$guidToken is not a GUID"
        return $false
    }

    return $true
}

#returns a path relative to the repo root for a file which has new code analysis issue(s)
function GetRelativeFilePath($component)
{
    if ($component -and $ComponentKeyAndRelativePathCache.ContainsKey($component))
    {
        $relativeFilePath = $ComponentKeyAndRelativePathCache[$component]
        Write-Verbose "GetRelativeFilePath: Found cached entry, returning data from cache, relativePath:$relativeFilePath"

        return $relativeFilePath
    }

    #sonar runner creates the component value as '[SonarQube project key]:[SonarQube project value]:[MSBuild project guid]:[file name relative to MSBuild project file path]'
    $tokens = $component.ToString().Split(":")
    $isFormatValid = IsComponentFormatValid($tokens)
    if (!$isFormatValid)
    {
        Write-Warning "Component is not in expected format, ignoring component:$component"
        return $null
    }

    #third token must be guid
    $guidToken = $tokens[2]
    Write-Verbose "GetRelativeFilePath: guidToken:$guidToken"

    if (!$ProjectGuidAndFilePathMap.ContainsKey($guidToken))
    {
        Write-Verbose "GetRelativeFilePath: An entry for project guid $guidToken could not be found, check ProjectInfo.xml file"
        return $null
    }
    if (!$ComponentKeyAndPathMap.ContainsKey($component))
    {
        Write-Verbose "GetRelativeFilePath: An entry for component key $component could not be found, check sonar-report.json file"
        return $null
    }

    #This stores the full on-disk path of the *.xxproj file
    $projectPath = $($ProjectGuidAndFilePathMap[$guidToken])

    $finalFilePath = [System.IO.Path]::GetDirectoryName($projectPath)
    
    $finalFilePath = [System.IO.Path]::Combine($finalFilePath, $ComponentKeyAndPathMap[$component])
    Write-Verbose "GetRelativeFilePath: finalFilePath:$finalFilePath"

    $repoLocalPath = GetTaskContextVariable "Build.Repository.LocalPath"
    
    if (!$repoLocalPath)
    {
        throw "GetRelativeFilePath: Could not get task variable Build.Repository.LocalPath"
    }

    Write-Verbose "GetRelativeFilePath: repoLocalPath:$repoLocalPath"

    #this will remove from the file path, the part upto the repo name. 
    #e.g. finalFilePath=C:\Agent\_work\ef030e14\s\Mail2Bug\Main.cs and repoLocalPath=C:\Agent\_work\ef030e14\s
    #after the SubString() call finalFilePath=\Mail2Bug\Main.cs
    $finalFilePath = $finalFilePath.ToString().SubString($repoLocalPath.Length);

    #Replace '\' with '/'. VSO expects file path like /Mail2Bug/Main.cs (\Mail2Bug\Main.cs does not work)
    $finalFilePath = $finalFilePath.ToString().Replace([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    Write-Verbose "GetRelativeFilePath: Returning finalFilePath:$finalFilePath"

    #save data into cache so next time we don't have to compute
    $ComponentKeyAndRelativePathCache.Add($component, $finalFilePath)

    return $finalFilePath
}

#endregion