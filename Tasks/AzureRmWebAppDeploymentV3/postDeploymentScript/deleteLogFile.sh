#!/bin/bash

rm "mainCmdFile_$1.sh"

rm "kuduPostDeploymentScript_$1.sh"

# Do not delete file if the execution is not completed within time range
# This can help in retrieving the logs and script result

if [ -f "script_result_$1.txt" ]
then
    echo "Removing log files."
    rm "stdout_$1.txt"
    rm "stderr_$1.txt"
    rm "script_result_$1.txt"
else 
	echo "Execution is not over."
fi

# Delete the file after execution 
echo "Removing the delete_log_file_$1.sh file."

rm "delete_log_file_$1.sh"
