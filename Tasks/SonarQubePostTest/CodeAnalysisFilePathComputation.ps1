. ./SonarQubePostTestImpl.ps1

$ProjectGuidAndFilePathMap = @{}
$ComponentKeyAndPathMap = @{}
$ComponentKeyAndRelativePathCache = @{}

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

function IsComponentFormatValid($tokens)
{
    #expected format for component '[SonarQube project key]:[SonarQube project value]:[MSBuild project guid]:[file name relative to MSBuild project file path]'
    $isFormatValid = $false

    if (!$tokens)
    {
        Write-Verbose "IsComponentFormatValid: tokens is invalid"
        return $isFormatValid
    }
    if ($tokens.Count -ne 4) 
    {
        Write-Verbose "IsComponentFormatValid: component is not in expected format, token count is not equal to 4"
        return $isFormatValid
    }

    #third token must be a guid
    $guidToken = $tokens[2]

    $outGuid = New-Object -TypeName "System.Guid"
    if (![System.Guid]::TryParse($guidToken, [ref]$outGuid))
    {
        Write-Verbose "$guidToken is not a GUID"
        return $isFormatValid
    }

    $isFormatValid = $true
    return $isFormatValid
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

    $repoLocalPath = Get-TaskVariable -Context $distributedTaskContext -Name "Build.Repository.LocalPath"
    if (!$repoLocalPath)
    {
        Write-Verbose "GetRelativeFilePath: Could not get task variable Build.Repository.LocalPath"
        return $null
    }

    Write-Verbose "GetRelativeFilePath: repoLocalPath:$repoLocalPath"

    #this will remove from the file path, the part upto the repo name. 
    #e.g. finalFilePath=C:\Agent\_work\ef030e14\s\Mail2Bug\Main.cs and repoLocalPath=C:\Agent\_work\ef030e14\s
    #after the SubString() call finalFilePath=\Mail2Bug\Main.cs
    $finalFilePath = $finalFilePath.ToString().SubString($repoLocalPath.Length);

    #Replace '\' with '/'. VSTS expects file path like /Mail2Bug/Main.cs (\Mail2Bug\Main.cs does not work)
    $finalFilePath = $finalFilePath.ToString().Replace([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    Write-Verbose "GetRelativeFilePath: Returning finalFilePath:$finalFilePath"

    #save data into cache so next time we don't have to compute
    $ComponentKeyAndRelativePathCache.Add($component, $finalFilePath)

    return $finalFilePath
}

function GetSonarReportProcessedFilePath
{    
    $sonarReportFolderPath = GetSonarScannerDirectory
    $sonarReportProcessedFilePath = [System.IO.Path]::Combine($sonarReportFolderPath, "code-analysis-report.json")

    return $sonarReportProcessedFilePath
}

function GetSonarReportFilePath
{ 
    $sonarReportFolderPath = GetSonarScannerDirectory
    $sonarReportFilePath = [System.IO.Path]::Combine($sonarReportFolderPath, "sonar-report.json")

    return $sonarReportFilePath
}

function UploadCodeAnalysisArtifact
{
    $sonarReportProcessedFilePath = GetSonarReportProcessedFilePath

    if ([System.IO.File]::Exists($sonarReportProcessedFilePath))
    {
        Write-Host "Uploading issues identified by the analysis as an artifact $sonarReportProcessedFilePath"
        Write-Host "##vso[artifact.upload containerfolder=CodeAnalysisIssues;artifactname=CodeAnalysisIssues;]$sonarReportProcessedFilePath"
    }
    else
    {
        Write-Warning "Could not find the file containing issues identified by the analysis at $sonarReportProcessedFilePath"
    }
}

function ProcessSonarCodeAnalysisReport
{    
    $sonarReportFilePath = GetSonarReportFilePath
    $sonarReportProcessedFilePath = GetSonarReportProcessedFilePath

    #read sonar-report.json file as a json object
    $sonarReportFileContent = Get-Content -Raw $sonarReportFilePath
    $jsonSer = New-Object -TypeName System.Web.Script.Serialization.JavaScriptSerializer
    
    #default value of MaxJsonLength is 2,097,152. Increasing max length by a factor of 10 to handle bigger file sizes
    $jsonSer.MaxJsonLength = 2097152 * 10
    $json = $jsonSer.DeserializeObject($sonarReportFileContent)

    Write-Verbose "ProcessSonarCodeAnalysisReport: Total issues: $($json.issues.Count)"

    ConstructComponentKeyAndPathMap $json

    # '@' makes sure the result set is returned as an array
    $newIssues = @($json.issues | Where {$_.isNew -eq $true})
    Write-Verbose "ProcessSonarCodeAnalysisReport: Total new issues: $($newIssues.Count)"

    if ($($newIssues.Count) -gt 0)
    {
        foreach ($issue in $newIssues)
        {
            $filePath = GetRelativeFilePath $($issue.component)

            #add a new property in json which stores the file path so it can be consumed directly
            Add-Member -InputObject $issue -MemberType NoteProperty -Name relativePath -Value $filePath
        }
    }

    $sonarReportProcessedRootObj = New-Object -TypeName PSObject
    Add-Member -InputObject $sonarReportProcessedRootObj -MemberType NoteProperty -Name status -Value "Analysis Complete"
    Add-Member -InputObject $sonarReportProcessedRootObj -MemberType NoteProperty -Name issues -Value $newIssues

    #save the results into output file
    $sonarReportProcessedRootObj | ConvertTo-Json | Set-Content -Path $sonarReportProcessedFilePath
}

# Creates a mapping of msbuild project guid and the path of .xxproj file on disk using ProjectInfo.xml file
function CreateProjectGuidAndPathMap
{        
    $parentFolder = GetSonarQubeOutDirectory
    $parentFolderItem = Get-Item $parentFolder
    $directories = $parentFolderItem.GetDirectories()

    Write-Host "Processing project info files..."

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

# Post-process sonar runner output (sonar-report.json) to generate code-analysis-report.json which has new issues only and repo relative file paths
function GenerateCodeAnalysisReport
{  
    Write-Host "Post-processing the SonarQube analysis report..."    

    #bail out if sonar-report.json does not exist
    $sonarReportFilePath = GetSonarReportFilePath
    if (![System.IO.File]::Exists($sonarReportFilePath))
    {
        Write-Warning "Could not find file $sonarReportFilePath"
        return
    }

    Write-Verbose "Report file found at $sonarReportFilePath"    

    CreateProjectGuidAndPathMap
    ProcessSonarCodeAnalysisReport

    UploadCodeAnalysisArtifact
}
