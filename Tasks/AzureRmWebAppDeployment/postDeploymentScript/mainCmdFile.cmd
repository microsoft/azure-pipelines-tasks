@echo off

:: Send stdout and stderr to seperate file
:: write return code of previous command to script_result file
:: only return code (Numeric code) should present inside script_result

cmd /c "kuduPostDeploymentScript_%1.cmd" > "stdout_%1.txt" 2> "stderr_%1.txt" && (
  echo Deployment Script executed successfully.
  echo 0 > "script_result_%1.txt"
) || (
    echo Deployment script execution failed !
    echo 1 > "script_result_%1.txt" 
)