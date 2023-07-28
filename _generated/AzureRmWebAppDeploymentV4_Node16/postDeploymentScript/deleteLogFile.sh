#!/bin/bash

rm "mainCmdFile.sh"

rm "kuduPostDeploymentScript.sh"

# Do not delete file if the execution is not completed within time range
# This can help in retrieving the logs and script result

if [ -f "script_result.txt" ]
then
    echo "Removing log files."
    rm "stdout.txt"
    rm "stderr.txt"
    rm "script_result.txt"
else 
	echo "Execution is not over."
fi

# Delete the file after execution 
echo "Removing the delete_log_file.sh file."

rm "delete_log_file.sh"
