#!/bin/bash
# Send stdout and stderr to seperate file
sh "$HOME/site/VSTS_PostDeployment_$1/kuduPostDeploymentScript.sh" 2> "$HOME/site/VSTS_PostDeployment_$1/stderr.txt" 1> "$HOME/site/VSTS_PostDeployment_$1/stdout.txt" 
echo "$?" > "$HOME/site/VSTS_PostDeployment_$1/script_result.txt"
