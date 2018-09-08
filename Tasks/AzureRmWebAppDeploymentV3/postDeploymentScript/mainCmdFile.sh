#!/bin/bash
# Send stdout and stderr to seperate file
sh "kuduPostDeploymentScript_$1.sh" 2> "stderr_$1.txt" 1> "stdout_$1.txt" 
echo "$?" > "script_result_$1.txt"