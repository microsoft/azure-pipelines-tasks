#!/bin/bash
tar -xzC . -f $1

escapedScript=$(echo $2 | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/`/\\`/g' -e 's/\$/\\$/g')
quotedScript="./\""$escapedScript"\""
escapedArgs=$(echo $3 | sed -e 's/`/\\`/g' -e 's/\$/\\$/g')

command=$quotedScript" "$escapedArgs
echo "Command: "$command

eval $command