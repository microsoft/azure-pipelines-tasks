@echo off

:: Send stdout and stderr to seperate file
call cmd /c "%Home%\\site\\VSTS_PostDeployment_%1\\kuduPostDeploymentScript.cmd" > "%Home%\\site\\VSTS_PostDeployment_%1\\stdout.txt" 2> "%Home%\\site\\VSTS_PostDeployment_%1\\stderr.txt"

:: write return code of previous command to script_result file
:: only return code (Numeric code) should present inside script_result

echo %errorlevel% > "%Home%\\site\\VSTS_PostDeployment_%1\\script_result.txt"