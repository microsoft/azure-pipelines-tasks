@echo off

:: Send stdout and stderr to seperate file
call cmd /c "kuduPostDeploymentScript_%1.cmd" > "stdout_%1.txt" 2> "stderr_%1.txt"

:: write return code of previous command to script_result file
:: only return code (Numeric code) should present inside script_result

echo %errorlevel% > "script_result_%1.txt"