$script:ProjectGuidAndFilePathMap = @{}
$script:ComponentKeyAndPathMap = @{}
$script:ComponentKeyAndRelativePathMap = @{}

. $PSScriptRoot\..\Common\SonarQubeHelpers\SonarQubeHelper.ps1

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
        throw  [System.IO.FileNotFoundException] "Could not find the SonarQube issue report at $sonarReportFilePath. Unable to post issues to the PR."
    }

    Write-Verbose "Report file found at $sonarReportFilePath"    
        
    CreateProjectGuidToProjectPathMap    
    
    $sonarReportFilePath = GetSonarReportFilePath
    $json = DeserializeReport $sonarReportFilePath
    CreateComponentKeyToPathMap $json

    # '@' makes sure the result set is returned as an array
    $newIssues = @($json.issues | Where {$_.isNew -eq $true})
    Write-Host "SonarQube found $($json.issues.Count) issues out of which $($newIssues.Count) are new"

    $newIssues = AnnotateIssuesWithRelativePath $newIssues
    
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
    
    # Default value of MaxJsonLength is 2,097,152. Increasing max length to a 
    $jsonSer.MaxJsonLength = [int]::MaxValue
    $json = $jsonSer.DeserializeObject($sonarReportFileContent)   
    
    return $json 
}

#
# Creates a mapping between key and path for componets (a SonarQube concept that translates to msbuild projects)
#
function CreateComponentKeyToPathMap($json)
{
    foreach ($component in $json.components)
    {
        if (!$script:ComponentKeyAndPathMap.ContainsKey($component.key))
        {
            $script:ComponentKeyAndPathMap.Add($component.key, $component.path)
        }
        else 
        {
            Write-Verbose "Found a duplicate component key: $($component.key)"    
        }
    }
}

#
# Creates a mapping of msbuild project guid and the path of .xxproj file on disk using ProjectInfo.xml file
#
function CreateProjectGuidToProjectPathMap
{        
    $parentFolder = GetSonarQubeOutDirectory
    $parentFolderItem = Get-Item $parentFolder
    $directories = $parentFolderItem.GetDirectories()

    foreach ($directory in $directories)
    {
        $projectInfoFilePath = [System.IO.Path]::Combine($directory.FullName, "ProjectInfo.xml")
        
        if ([System.IO.File]::Exists($projectInfoFilePath))
        {
            Write-Verbose "CreateProjectGuidToProjectPathMap: Processing project info file: $projectInfoFilePath"
            [xml]$xmlContent = Get-Content $projectInfoFilePath
            
            Assert ($xmlContent -ne $null) "Internal error: could not read $projectInfoFilePath"
            Assert ($xmlContent.ProjectInfo.ProjectGuid -ne $null) "Internal error: could not read the ProjectGuid from $projectInfoFilePath"

            if (!$script:ProjectGuidAndFilePathMap.ContainsKey($xmlContent.ProjectInfo.ProjectGuid))
            {
                $script:ProjectGuidAndFilePathMap.Add($xmlContent.ProjectInfo.ProjectGuid, $xmlContent.ProjectInfo.FullPath)
            }
            else
            {
                Write-Verbose "Duplicate ProjectGuid found in $projectInfoFilePath"
            }
        }
    }
}

#
# Expected format for component '[SonarQube project key]:[SonarQube project value]:[MSBuild project guid]:[file name relative to MSBuild project file path]'
#
function GetComponentGuid
{
    param ([ValidateNotNullOrEmpty()][string]$component)    
  
    $tokens = $component.Split(":")

    if ($tokens.Count -ne 4) 
    {
        throw "Internal error: component $component is not in the expected format (expected 4 parts)"
    }

    #third token must be a guid
    $guidToken = $tokens[2]

    $outGuid = New-Object -TypeName "System.Guid"
    if (![System.Guid]::TryParse($guidToken, [ref]$outGuid))
    {
        throw "Internal error: $guidToken is not a GUID"
    }

    return $guidToken
}

#
# Returns a path relative to the repo root for a file which has new code analysis issue(s)
#
function GetPathRelativeToRepoRoot
{
    param ([ValidateNotNullOrEmpty()][string]$component)
    
    if ($component -and $script:ComponentKeyAndRelativePathMap.ContainsKey($component))
    {
        $relativeFilePath = $script:ComponentKeyAndRelativePathMap[$component]
        return $relativeFilePath
    }

    $guidToken = GetComponentGuid $component
    
    if (!$script:ProjectGuidAndFilePathMap.ContainsKey($guidToken))
    {
        Write-Verbose "GetPathRelativeToRepoRoot: An entry for project guid $guidToken could not be found, check ProjectInfo.xml file"
        return $null
    }
    if (!$script:ComponentKeyAndPathMap.ContainsKey($component))
    {
        Write-Verbose "GetPathRelativeToRepoRoot: An entry for component key $component could not be found, check sonar-report.json file"
        return $null
    }

    # This stores the full on-disk path of the *.xxproj file
    $projectPath = $($script:ProjectGuidAndFilePathMap[$guidToken])

    $finalFilePath = [System.IO.Path]::GetDirectoryName($projectPath)
    
    $finalFilePath = [System.IO.Path]::Combine($finalFilePath, $script:ComponentKeyAndPathMap[$component])

    $repoLocalPath = GetTaskContextVariable "Build.Repository.LocalPath"
    
    if (!$repoLocalPath)
    {
        throw "GetPathRelativeToRepoRoot: Could not get task variable Build.Repository.LocalPath"
    }

    $relativePath = GetRelativePath $finalFilePath $repoLocalPath
       
    #save data into cache so next time we don't have to compute
    $script:ComponentKeyAndRelativePathMap.Add($component, $relativePath)

    return $relativePath
}

# This will remove from the file path, the part up to the repo name. 
# e.g. finalFilePath=C:\Agent\_work\ef030e14\s\Mail2Bug\Main.cs and repoLocalPath=C:\Agent\_work\ef030e14\s
# after the SubString() call finalFilePath=\Mail2Bug\Main.cs
function GetRelativePath
{
    param ([ValidateNotNullOrEmpty()][string]$path1, [ValidateNotNullOrEmpty()][string]$path2)
    
    Assert ( $path1.StartsWith($path2, [StringComparison]::OrdinalIgnoreCase)) "Internal Error: expected $path2 to be a parent of $path1"
    
    $result = $path1.SubString($path2.Length);

    #Replace '\' with '/'. VSO expects file path like /Mail2Bug/Main.cs (\Mail2Bug\Main.cs does not work)
    $result = $result.Replace([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    
    return $result
}

function AnnotateIssuesWithRelativePath
{
    param ([Array]$issues)
    
    foreach ($issue in $issues)
    {
        $filePath = GetPathRelativeToRepoRoot $($issue.component)

        # Add a new property in the object which stores the file path so it can be consumed directly
        Add-Member -InputObject $issue -MemberType NoteProperty -Name "relativePath" -Value $filePath
    }
    
    return $issues
}

#endregion

# Export the public functions 
Export-ModuleMember -Function 'FetchAnnotatedNewIssues'