@echo off

DEL "mainCmdFile_%1.cmd" 

DEL "kuduPostDeploymentScript_%1.cmd"

DEL "stdout_%1.txt"

DEL "stderr_%1.txt"

DEL "script_result_%1.txt"

echo remove delete_log_file
:: Delete the file after execution 
DEL "%~f0" >nul 2>&1
