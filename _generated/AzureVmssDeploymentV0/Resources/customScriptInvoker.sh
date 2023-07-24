#!/bin/bash
if [ -n "$1" ]; then
    mkdir a
    echo "extracting archive $1"
    tar -xzC ./a -f $1
    cd ./a
fi

command=$2" "$3
echo "Invoking command: "$command

eval $command
