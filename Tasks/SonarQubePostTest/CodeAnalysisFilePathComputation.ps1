$ProjectGuidAndFilePathMap = @{}
$ComponentKeyAndPathMap = @{}
$ComponentKeyAndRelativePathCache = @{}

function ConstructComponentKeyAndPathMap($json)
{
    foreach ($component in $json.Components)
    {
        #Write-Host "Component Key: $($component.key), Path:$($component.path)"
        $ComponentKeyAndPathMap.Add($component.key, $component.path)
    }
}

#returns a path relative to the repo root for a file which has new code analysis issue(s)
function GetRelativeFilePath($component)
{
    if ($ComponentKeyAndRelativePathCache.ContainsKey($component))
    {
        $relativeFilePath = $ComponentKeyAndRelativePathCache[$component]
        Write-Verbose -Verbose "GetRelativeFilePath: Found cached entry, returning data from cache, relativePath:$relativeFilePath"

        return $relativeFilePath
    }

    #MSBuild runner creates the component value as '[SonarQube project key]:[SonarQube project value]:[MSBuild project guid]:[file name relative to MSBuild project file path]'
    $tokens = $component.ToString().Split(":")

    if ($tokens -eq $null)
    {
        Write-Verbose -Verbose "GetRelativeFilePath: tokens is null, component:$component"
        return $null
    }
    if ($tokens.Count -lt 2) 
    {
        Write-Verbose -Verbose "GetRelativeFilePath: tokens.count is less than 2, component:$component"
        return $null
    }

    #fair to assume second last token will be guid?
    $guidToken = $tokens[$tokens.Count - 2]
    Write-Verbose -Verbose "GetRelativeFilePath: guidToken:$guidToken"

    $outGuid = New-Object -TypeName "System.Guid"
    if (![System.Guid]::TryParse($guidToken, [ref]$outGuid))
    {
        Write-Verbose -Verbose "$guidToken is not a GUID, component:$component"
        return $null
    }
    if (!$ProjectGuidAndFilePathMap.ContainsKey($guidToken))
    {
        Write-Verbose -Verbose "GetRelativeFilePath: An entry for project guid $guidToken could not be found, check ProjectInfo.xml file"
        return $null
    }
    if (!$ComponentKeyAndPathMap.ContainsKey($component))
    {
        Write-Verbose -Verbose "GetRelativeFilePath: An entry for component key $component could not be found, check sonar-report.json file"
        return $null
    }

    #This stores the full on-disk path of the *.xxproj file
    $projectPath = $($ProjectGuidAndFilePathMap[$guidToken])

    $finalFilePath = [System.IO.Path]::GetDirectoryName($projectPath)
    
    $finalFilePath = [System.IO.Path]::Combine($finalFilePath, $ComponentKeyAndPathMap[$component])
    Write-Verbose -Verbose "GetRelativeFilePath: finalFilePath:$finalFilePath"

    $repoLocalPath = Get-TaskVariable -Context $distributedTaskContext -Name "Build.Repository.LocalPath"
    if (!$repoLocalPath)
    {
        Write-Verbose -Verbose "GetRelativeFilePath: Could not get task variable Build.Repository.LocalPath"
        return $null
    }

    Write-Verbose -Verbose "GetRelativeFilePath: repoLocalPath:$repoLocalPath"

    #this will remove from the file path, the part upto the repo name. 
    #e.g. finalFilePath=C:\Agent\_work\ef030e14\s\Mail2Bug\Main.cs and repoLocalPath=C:\Agent\_work\ef030e14\s
    #after the SubString() call finalFilePath=\Mail2Bug\Main.cs
    $finalFilePath = $finalFilePath.ToString().SubString($repoLocalPath.Length);

    #Replace '\' with '/'. VSO expects file path like /Mail2Bug/Main.cs (\Mail2Bug\Main.cs doesn't work)
    $finalFilePath = $finalFilePath.ToString().Replace([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    Write-Verbose -Verbose "GetRelativeFilePath: Returning finalFilePath:$finalFilePath"

    #save data into cache so next time we don't have to compute
    $ComponentKeyAndRelativePathCache.Add($component, $finalFilePath)

    return $finalFilePath
}

function ProcessSonarCodeAnalysisReport
{
    param([string][ValidateNotNullOrEmpty()]$agentBuildDirectory)

    $sonarReportFolderPath = [System.IO.Path]::Combine($agentBuildDirectory, ".sonarqube", "out", ".sonar")
    $sonarReportFilePath = [System.IO.Path]::Combine($sonarReportFolderPath, "sonar-report.json")

    $sonarReportFilePathProcessed = [System.IO.Path]::Combine($sonarReportFolderPath, "code-analysis-report.json")
    
    if (![System.IO.File]::Exists($sonarReportFilePath))
    {
        Write-Host "ProcessSonarCodeAnalysisReport: $sonarReportFilePath does not exist! Returning.."
        return;
    }

    #read sonar-report.json file as a json object
    $json = Get-Content -Raw $sonarReportFilePath | ConvertFrom-Json
    Write-Verbose -Verbose "ProcessSonarCodeAnalysisReport: Total issues: $($json.issues.Count)"

    ConstructComponentKeyAndPathMap $json

    # '@' makes sure the result set is returned as an array
    $newIssues = @($json.issues | Where {$_.isNew -eq $true})
    Write-Verbose -Verbose "ProcessSonarCodeAnalysisReport: Total new issues: $($newIssues.Count)"

    if ($($newIssues.Count) -gt 0)
    {
        foreach ($issue in $newIssues)
        {
            $filePath = GetRelativeFilePath $($issue.component)

            #add a new property in json which stores the file path so it can be consumed directly
            Add-Member -InputObject $issue -MemberType NoteProperty -Name relativePath -Value $filePath
        }

        #save the results into output file
        $newIssues | ConvertTo-Json | Set-Content -Path $sonarReportFilePathProcessed
    }
}

#creates a mapping of msbuild project guid and the path on disk using ProjectInfo.xml file
function CreateProjectGuidAndPathMap
{
    param([string][ValidateNotNullOrEmpty()]$agentBuildDirectory)

    $parentFolder = [System.IO.Path]::Combine($agentBuildDirectory, ".sonarqube", "out")
    $parentFolderItem = Get-Item $parentFolder
    $directories = $parentFolderItem.GetDirectories()     

    foreach ($directory in $directories)
    {
        $projectInfoFilePath = [System.IO.Path]::Combine($directory.FullName, "ProjectInfo.xml")
        
        #Write-Host $projectInfoFilePath
        
        if ([System.IO.File]::Exists($projectInfoFilePath))
        {
            Write-host "CreateProjectGuidAndPathMap: Processing project info file: $projectInfoFilePath"
            [xml]$xmlContent = Get-Content $projectInfoFilePath

            if ($xmlContent -ne $null)
            {
                $ProjectGuidAndFilePathMap.Add($xmlContent.ProjectInfo.ProjectGuid, $xmlContent.ProjectInfo.FullPath)
            }
        }
    }
}

function ComputeCodeAnalysisFilePaths
{
    param([string][ValidateNotNullOrEmpty()]$agentBuildDirectory)

    Write-Host "Starting code analysis file path computation..."

    Write-Verbose -Verbose "ComputeCodeAnalysisFilePaths: buildAgentDir=$agentBuildDirectory"
    
    CreateProjectGuidAndPathMap $agentBuildDirectory
    ProcessSonarCodeAnalysisReport $agentBuildDirectory
}
