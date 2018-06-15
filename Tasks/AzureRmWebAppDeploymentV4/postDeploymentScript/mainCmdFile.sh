#!/bin/bash
# Send stdout and stderr to seperate file
sh "$Home\\site\\VSTS_PostDeployment_$1\\kuduPostDeploymentScript.sh" 2> "$Home\\site\\VSTS_PostDeployment_$1\\stderr.txt" 1> "$Home\\site\\VSTS_PostDeployment_$1\\stdout.txt" 
echo "$?" > "$Home%\\site\\VSTS_PostDeployment_$1\\script_result.txt"