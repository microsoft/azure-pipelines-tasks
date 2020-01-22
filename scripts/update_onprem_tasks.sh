#!/bin/bash

set -e

# Defaults
declare -i LOG_LEVEL=3
declare COLLECTION_URL
declare TOKEN

# Logging utility
# Constants
declare -r LOG_INFO_COLOR="\033[1m"
declare -r LOG_WARN_COLOR="\033[1;33m"
declare -r LOG_ERROR_COLOR="\033[1;31m"
declare -r LOG_DEBUG_COLOR="\033[1;34m"
declare -r LOG_DEFAULT_COLOR="\033[0m"
declare -r LOG_SUCCESS_COLOR="\033[1;32m"

declare -Ar AUTH_TASKS=([0]="MavenAuthenticateV0" [1]="NpmAuthenticateV0" [2]="PipAuthenticateV1" [3]="TwineAuthenticateV1" [4]="NuGetAuthenticateV1")
declare -Ar LOG_LEVELS=([0]="ERROR" [1]="WARNING" [2]="INFO" [3]="DEBUG")

log() {
    local log_text="$1"
    local log_level=${2}
    local log_color="$3"
    
    if [ ${LOG_LEVEL} -ge ${log_level} ]; then
        echo -ne "${log_color}${log_text}${LOG_DEFAULT_COLOR}"
    fi
    return 0
}

log_error() { log "$1" 0 "${LOG_ERROR_COLOR}"; }
log_warning() { log "$1" 1 "${LOG_WARN_COLOR}"; }
log_info() { log "$1" 2 ${LOG_INFO_COLOR}; }
log_success() { log "$1" 3 "${LOG_SUCCESS_COLOR}"; }
log_debug() { log "$1" 4 "${LOG_DEBUG_COLOR}"; }

# END Logging utility

# Command line parameters, we need:
# * Collection URL
# * PAT
# * Proxy configuration (if any)
# * Logging verbosity
get_args() {
    while [[ ${1} ]]; do
        case "${1}" in
            --verbose | -v)
                LOG_LEVEL=4
            ;;
            --collection-url | -c)
                COLLECTION_URL=${2%/}
                shift
            ;;
            --token | -t)
                if [ -z ${2} ]; then
                    log_error "Missing required parameter: 'token'"
                    display_help
                    exit 1
                fi
                TOKEN=${2}
                shift
            ;;
            --help | -h)
                display_help
                exit 0
            ;;
            *)
                log_error "Unknown parameter: ${1}"
                display_help
                exit 1
            ;;
        esac
        
        if ! shift; then
            log_error 'Missing parameter argument.'
            exit 1
        fi
    done
}

# Display help function
display_help() {
    echo 'Display help'
}

# Check for required args
get_args "${@}"

if [ -z ${COLLECTION_URL} ]; then
    log_error "Missing required parameter: 'collection-url'"
    display_help
    exit 1
fi

# Check for installed software, we need:
# * nodejs + npm
# * jq
# * git

log_info "Checking for requirements..."
if $(node -v >/dev/null); then
    log_debug "\n'node.js' is installed.\n"
else
    log_error "\nRequired dependency node.js is not installed. Please download and install 'node.js' from here before proceeding: https://nodejs.org/en/download/"
    exit 1
fi

if $(jq --help >/dev/null); then
    log_debug "'jq' is installed.\n"
else
    log_error "\nRequired dependency 'jq' is not installed. Please download and install 'jq' for your OS from here before proceeding: https://stedolan.github.io/jq/download/"
    exit 1
fi

if $(git --version >/dev/null); then
    log_debug "'git' is installed.\n"
else
    log_error "\nRequired dependency 'git' is not installed. Please download and install 'git' for your OS from here before proceeding: https://git-scm.com/downloads"
    exit 1
fi

log_success "Ok\n"

# Download tfx-cli
log_info "Installing tfx-cli..."
# TODO REMOVE THIS COMMENT
#sudo npm install -g tfx-cli > /dev/null 2>&1
log_success "Ok\n"

# Download & build the tasks
log_info "Cloning tasks repository..."
pushd /tmp/azurepipelinestasks >/dev/null 2>&1

# git clone -q --single-branch --no-tags https://github.com/microsoft/azure-pipelines-tasks.git /tmp/azurepipelinestasks`
npm install >/dev/null 2>&1
log_success "Ok\n"


log_info "\nBuilding and uploading tasks.\n"
for task in "${AUTH_TASKS[@]}"; do
    log_info "  Processing task ${task}: "
    node make.js build --task ${task} >/dev/null 2>&1
    tfx build tasks upload --overwrite --task-path ./_build/Tasks/${task} --service-url ${COLLECTION_URL}  --token ${TOKEN} 
    log_success "Done\n"
done

# Get list of tasks from TFS and verify they were updated.

# Clean up
# * Remove tfx-cli ??
# * Remove any files that were downloaded.
