################################################################################################################################################
### This script will run when you build the entire solution.
### The script will find all "temp" folder under $sourceFolder. Read the task.json file from each temp folder. Get task name and version from task.json
### Create "taskname\taskversion" folder in $packageFolder, copy all file from temp folder to that folder
################################################################################################################################################
param
(
    [string]$sourceFolder,
    [string]$packageFolder, 
    [string]$readmeFile
)

Write-Host sourceFolder = $sourceFolder
Write-Host packageFolder = $packageFolder
Write-Host readmeFile = $readmeFile

#verify Source folder, Package folder and README.md file exist
if( -Not (Test-Path $sourceFolder))
{
    Write-Error -Message "Source folder is not found in path: $sourceFolder"
    return
}

if( -Not (Test-Path $packageFolder))
{
    New-Item -Path $packageFolder -ItemType Directory -Force -ErrorAction Stop
}

if( -Not (Test-Path $readmeFile))
{
    Write-Error -Message "readme.md file is not found in path: $readmeFile"
    return
}

#Publish Tasks to Package folder.
$tasksSrc = Get-ChildItem -Path $sourceFolder -Filter "temp" -Recurse |where{$_.PSIsContainer}

$taskinfo = ""

foreach($src in $tasksSrc)
{
    Write-Host task.json location: (Join-Path -Path $src.FullName -ChildPath "task.json")
    $json = (Get-Content -Path (Join-Path -Path $src.FullName -ChildPath "task.json")) -join "`r`n"  

    $taskDef = ConvertFrom-Json -InputObject $json -ErrorAction Stop
    
    $taskName = $taskDef.name
    Write-Host taskName = $taskName

    $taskVersion = $taskDef.version.Major.ToString()+"."+
                   $taskDef.version.Minor.ToString()+"."+
                   $taskDef.version.Patch.ToString()
    Write-Host taskVersion = $taskVersion

	$taskDir = [System.IO.Path]::Combine($packageFolder,"Tasks",$taskName)
    if(Test-Path $taskDir)
    {
        Write-Host $taskDir already exist, try to delete everything in it.
        Remove-Item -Path $taskDir\* -Recurse -Force -ErrorAction Stop
    }

	$dstDir = [System.IO.Path]::Combine($packageFolder,"Tasks",$taskName,$taskVersion)    
    Write-Host Create directory: $dstDir.
    $dstDir = New-Item -Path $dstDir -ItemType Directory -Force -ErrorAction Stop

    Copy-Item -Path (Join-Path -Path $src.FullName -ChildPath "*") -Destination $dstDir -Recurse

    #construct task info for each task.(format:  - Task: TaskName --- Version: 0.0.0)
    $taskinfo = $taskinfo + '- Task: ' +$taskName +" --- Version: "+$taskVersion+"`r`n"
}

$taskinfo = $taskinfo.TrimEnd("`r`n")
Write-Host taskinfo = $taskinfo

#jpricket - removing these lines so we can maintain the readme file manually
#remove all existing task info from README.md
#$initContent= (Get-Content $readmeFile |Where{$_ -notmatch '^- Task: '}) -join "`r`n"
#Set-Content $readmeFile $initContent

#add task info to README.md
#Add-Content $readmeFile $taskinfo
