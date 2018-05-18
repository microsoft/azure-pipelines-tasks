@echo off

DEL "mainCmdFile_%1.cmd" 

DEL "kuduPostDeploymentScript_%1.cmd"

:: Do not delete file if the execution is not completed within time range
:: This can help in retrieving the logs and script result

if exist "script_result_%1.txt" (

    echo remove log files

    DEL "stdout_%1.txt"

    DEL "stderr_%1.txt"

    DEL "script_result_%1.txt"
)

:: Delete the file after execution 
echo remove delete_log_file

DEL "%~f0" >nul 2>&1
