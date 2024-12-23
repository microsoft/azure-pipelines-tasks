@echo off

DEL "mainCmdFile.cmd" 

DEL "kuduPostDeploymentScript.cmd"

:: Do not delete file if the execution is not completed within time range
:: This can help in retrieving the logs and script result

if exist "script_result.txt" (

    echo remove log files

    DEL "stdout.txt"

    DEL "stderr.txt"

    DEL "script_result.txt"
)

:: Delete the file after execution 
echo remove delete_log_file

DEL "%~f0" >nul 2>&1
