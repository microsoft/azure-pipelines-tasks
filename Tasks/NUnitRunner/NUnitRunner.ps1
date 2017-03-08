###########Define Variables########
param(
    [string]$libsPath,
    [string]$libsToRun,
    [string]$includeCategories,
    [string]$excludeCategories,
    [string]$testsToRun,
    [string]$platformX86,
    [string]$platformX64,
    [string]$separateRun,
    [string]$failOnTestFailure
)


########### Functions #############
function NunitCmdLineRunner
{
    param(
        [string]$Platform
    )

    $Platform = $Platform.ToLower()
    #set tool path according to platform
    if(($Platform -eq "x86") -or ($Platform -eq "win32"))
    {        
        $nunitToolPath = """C:\Program Files (x86)\NUnit 2.6.3\bin\nunit-console-x86.exe"""
    }
    else
    {
        $nunitToolPath = """C:\Program Files (x86)\NUnit 2.6.3\bin\nunit-console.exe"""
    }

    #$workingDir = $env:BUILD_REPOSITORY_LOCALPATH 
    $workingDir = $libsPath

    [string[]]$libsArray = $libsToRun.Split(',');

    foreach ($item in $libsArray) 
    {
        Write-Host "Searching for files that matchs the name [$item]"
        #need to make sure that the file path not contains wrong platform 
        if(($Platform -eq "x86") -or ($Platform -eq "win32"))
        {        
            $libs = Get-ChildItem -Path $libsPath -Recurse -filter "$item" | Where-Object {
                ($_.FullName.ToString().ToLower()) -notlike "*x64*" -and ($_.FullName.ToString().ToLower()) -notlike "*win64*"
            }
        }
        else
        {
            $libs = Get-ChildItem -Path $libsPath -Recurse -filter "$item" | Where-Object {
                ($_.FullName.ToString().ToLower()) -notlike "*x86*" -and ($_.FullName.ToString().ToLower()) -notlike "*win32*"
            }
        }

        if(!$libs)
        {
            throw "ERROR: File named [$item] NOT found."
        }
        else 
        {
            #loop to run each test lib
            foreach ($lib in $libs) 
            {               
                $libFullPath = ($lib.FullName)
                $libName = [io.path]::GetFileNameWithoutExtension($libFullPath)

                Write-Host "File named [$item] found at: $libFullPath"

                $nunitArgs = ("""{0}""" -f $libFullPath)
                $nunitLogName = ("{0}\log_{1}_{2}" -f $workingDir, $Platform, $libName)

                if($excludeCategories){
                     $nunitArgs += " /exclude:""$excludeCategories"""
                }                
                
                if([System.Convert]::ToBoolean($separateRun))
                {# run separately
                    $separator = ","
                    $listOfCategories = $includeCategories.Split($separator)
                    $listOfTestsToRun = $testsToRun.Split($separator)

                    if($listOfCategories)
                    { 
                        foreach ($categoryName in $listOfCategories) 
                        {                                    
                            if($listOfTestsToRun)
                            {
                                foreach ($testName in $listOfTestsToRun) 
                                {                     
                                    $args = $nunitArgs + " /include:""$categoryName""" + " /run:$testName"
                                    $logName = ("{0}_{1}_{2}" -f $nunitLogName, $categoryName, $testName)
                                    NunitToolRunner -toolPath $nunitToolPath -arguments $args -logName $logName
                                }                                
                            }
                            else
                            {      
                                $args = $nunitArgs + " /include:""$categoryName"""
                                $logName = ("{0}_{1}" -f $nunitLogName, $categoryName)
                                NunitToolRunner -toolPath $nunitToolPath -arguments $args -logName $logName                          
                            }
                        }
                   }
                   else
                   {
                        if($listOfTestsToRun)
                        {
                            foreach ($testName in $listOfTestsToRun) 
                            {                     
                                $args = $nunitArgs + " /run:$testsToRun"                                           
                                $logName = ("{0}_{1}" -f $nunitLogName, $testsToRun)
                                NunitToolRunner -toolPath $nunitToolPath -arguments $args -logName $logName
                            }
                        }
                        else
                        {                         
                            NunitToolRunner -toolPath $nunitToolPath -arguments $nunitArgs -logName $nunitLogName
                        }
                   }
                }
                else
                {# regular run 
                    if($includeCategories){
                        $nunitArgs += " /include:""$includeCategories"""
                    }  
                    if($testsToRun){
                        $nunitArgs += " /run:$testsToRun"
                    }

                    NunitToolRunner -toolPath $nunitToolPath -arguments $nunitArgs -logName $nunitLogName
                }
                Write-Host "******************************************************************************" 
            }
        }
    }
}

function NunitToolRunner
{
    param(
        [string]$toolPath,
        [string]$arguments,
        [string]$logName
    )

    $arguments += (" /out:""{0}_log.log""" -f $logName)
    $arguments += (" /err:""{0}_err.log""" -f $logName)
    $result = ("""{0}_out.xml""" -f $logName) 
    $arguments += (" /result:{0}" -f $result)   

    $commandLine = ("{0} {1}" -f $ToolPath, $arguments)
    Write-Host "Tool Run Command Line:  $commandLine"
    Invoke-Command -ScriptBlock { cmd.exe /C "$commandLine"}
    if([System.Convert]::ToBoolean($failOnTestFailure))
    {
        CheckTestsStatus -xmlPath $result
    }
}

function CheckTestsStatus
{
    param(
        [string]$xmlPath
    )
    #$xmlContent = [IO.File]::ReadAllLines($xmlPath)
    #if(!($xmlContent -like "*failures=""0""*"))
    #{
    #    Write-Warning "ERROR: Some Tests Failed"
    #}
    if($LASTEXITCODE -ne 0)
    {
        $error = "ERROR: Tests failed [at: $xmlPath] - Exit Code = $LASTEXITCODE"
        Write-Error $error
        #Write-Host "##vso[task.logissue type=error;]$error"
    }
}


########### Execution #############
if(!$libsPath)
{
    $libsPath = $env:AGENT_BULDDIRECTORY
}
Write-Host "Tests Libraries Path: $libsPath"

Try
{
    if([System.Convert]::ToBoolean($platformX86)){
        Write-Host "******************************* Run x86 Tests *******************************"
        NunitCmdLineRunner -Platform "x86"
    }

    if([System.Convert]::ToBoolean($platformX64)){
        Write-Host "******************************* Run x64 Tests *******************************"
        $strCommand += $nunitX64Path
        NunitCmdLineRunner -Platform "x64"
    }
}

Catch
{
    Write-Error $_.Exception.ToString()
}

Finally
{
    Write-Output "Execution Completed."
}

#################################################################################