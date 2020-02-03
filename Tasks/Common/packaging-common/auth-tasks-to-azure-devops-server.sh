#!/bin/bash

set -e

# PARAMS
declare -i LOG_LEVEL=3
declare COLLECTION_URL
declare TOKEN
declare PROXY

# Global constants
declare -Ar AUTH_TASKS=([MavenAuthenticateV0]="MavenAuthenticateV0" [NpmAuthenticateV0]="npmAuthenticateV0" [PipAuthenticateV1]="PipAuthenticateV1" [TwineAuthenticateV1]="TwineAuthenticateV1" [NuGetAuthenticateV0]="NuGetAuthenticateV0")

# Logging utility
# Constants
declare -r LOG_INFO_COLOR="\033[1m"
declare -r LOG_WARN_COLOR="\033[1;33m"
declare -r LOG_ERROR_COLOR="\033[1;31m"
declare -r LOG_DEBUG_COLOR="\033[1;34m"
declare -r LOG_DEFAULT_COLOR="\033[0m"
declare -r LOG_SUCCESS_COLOR="\033[1;32m"

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
                COLLECTION_URL=${2}
                shift
            ;;
            --token | -t)
                TOKEN=${2}
                shift
            ;;
            --proxy | -p)
                PROXY=${2}
                shift
            ;;
            --help | -h)
                display_help
                exit 0
            ;;
            *)
                log_error "Unknown parameter: ${1}\n\n"
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
    echo ''
    echo 'Utility script to upload protocol authentication tasks to Azure DevOps Server.';
    echo ''
    echo 'Usage: auth-tasks-to-azure-devops-server.sh [options]'
    echo ''
    echo 'Options:'
    echo ''
    echo '  --collection-url,-c        The url of the collection where the build tasks need'
    echo '                             to be updated. Ex. https://{server}:8080/tfs/CollectionName'
    echo '  --token,-t                 The Personal Authentication Token (PAT) that is scoped for'
    echo '                             your collection. To learn about generating a PAT, please'
    echo '                             go to https://aka.ms/azdevops-pat'
    echo '  --proxy,-p                 Use the specified proxy server for HTTP traffic.'
    echo '  --verbose,-v               Display verbose logs.'
    echo '  --help,-h                  Display this help'
    echo ''
}

# Get system arch
get_arch() {
    arch=`arch`
    if [ "${arch}" == "x86_32" ]; then
        arch="x86";
    fi
    if [ "${arch}" == "x86_64" ]; then
        arch="x64";
    fi
    echo $arch;
}

# Get os name
get_os() {
    os=`uname -s | awk '{print tolower($0)}'`;
    echo $os;
}

# Check for required args
get_args "${@}"

if [ -z ${TOKEN} ]; then
    log_error "Missing required parameter: 'token'"
    display_help
    exit 1
fi

if [ -z ${COLLECTION_URL} ]; then
    log_error "Missing required parameter: 'collection-url'"
    display_help
    exit 1
fi
COLLECTION_URL="${COLLECTION_URL%/}"

# Create temporary directory
working_dir=$(mktemp -d -t uot-XXXXXXXXXX)
pushd $working_dir > /dev/null 2>&1

# Log error and exit
leae() {
    log_error "$1\n";
    
    log_info "Cleaning up..."
    popd >/dev/null 2>&1
    rm -rf $working_dir
    log_success "Done\n"
    
    exit 1;
}

# Check for installed software that the customer needs to install, we need:
# * git
# * tar

log_info "Checking for requirements..."

git --version >/dev/null || leae "\nRequired dependency 'git' is not installed. Please download and install 'git' for your OS from here before proceeding: https://git-scm.com/downloads"
log_debug "\n'git' is installed.\n"

tar --version >/dev/null || leae "\nRequired dependency 'tar' is not installed. Please download and install 'tar' for your OS before proceeding."
log_debug "'tar' is installed.\n"

jq --help >/dev/null || leae "\nRequired dependency 'jq' is not installed. Please download and install 'jq' for your OS from here before proceeding: https://stedolan.github.io/jq/download/"
log_debug "'jq' is installed.\n"

log_success "Done\n"

# Install our requirements, we need:
# * nodejs + npm
# * jq

# Install our version of node that is supported. (v8.17.0)
log_info "Installing required software..."

# Install npm
node_ver="node-v8.17.0-$(get_os)-$(get_arch)";
npm_download_url="https://nodejs.org/dist/v8.17.0/${node_ver}.tar.gz";

# Set proxy for wget
if [[ -n ${PROXY} ]]; then
    export http_proxy=$PROXY;
    export https_proxy=$PROXY;
    export use_proxy=on;
fi
wget $npm_download_url > /dev/null 2>&1 || leae "\nUnable to download required dependency 'npm' from url ${npm_download_url}. Please verify your internet connection or specify proxy parameters."

mkdir nodejs > /dev/null 2>&1;
tar -xvzf ${node_ver}.tar.gz -C nodejs > /dev/null  || leae "\nUnable to install required dependency 'npm'."

log_debug "\n'npm' installed locally.\n"
nodejsbin="${working_dir}/nodejs/${node_ver}/bin/node";
npmbin="${working_dir}/nodejs/${node_ver}/bin/npm";

# Set proxy for npm
if [[ -n ${PROXY} ]]; then
    eval "${npmbin} config set proxy ${PROXY} > /dev/null 2>&1"
    eval "${npmbin} config set https-proxy ${PROXY} > /dev/null 2>&1"
fi

# Install tfx-cli
eval "${npmbin} install -g tfx-cli > /dev/null 2>&1" || leae "Unable to install required dependency 'tfx-cli' from npm."
log_debug "'tfx-cli' installed locally.\n"

log_success "Done\n"

# Download & build the tasks
log_info "Cloning tasks repository..."

# Set proxy for git
if [[ -n ${PROXY} ]]; then
    git config --local  http.proxy $PROXY > /dev/null 2>&1
fi

git clone -q --single-branch --no-tags https://github.com/microsoft/azure-pipelines-tasks.git $working_dir/azurepipelinestasks || leae "\nUnable to clone azure-pipelines-tasks repository."

pushd $working_dir/azurepipelinestasks >/dev/null 2>&1
eval "${npmbin} install >/dev/null 2>&1" || leae "\nUnable to resolve azure-pipelines-tasks dependencies."
log_success "Done\n"

log_info "Building and uploading tasks...\n"
tfx login --service-url ${COLLECTION_URL} --token ${TOKEN} --proxy ${PROXY} >/dev/null 2>&1 || leae "\nUnable to login to collection using the given token."
for taskkey in "${!AUTH_TASKS[@]}"; do
    task=${AUTH_TASKS[$taskkey]};
    log_info "  ${taskkey}: "
    
    # Check if the task is already installed on the instance.
    current_onprem_version=`tfx build tasks list --proxy ${PROXY} --json | jq ".[] | select(.name==\"${task%??}\").version | \"\(.major).\(.minor).\(.patch)\""`
    current_built_version=`cat Tasks/${taskkey}/task.loc.json  | jq '.version | "\(.Major).\(.Minor).\(.Patch)"'`
    lowest_version=`printf "${current_onprem_version}\n${current_built_version}" | sort -V | head -1`
    
    if [  "${lowest_version}" == "${current_built_version}" ]; then
        log_warning "Skipped\n"
    else
        node make.js build --task ${taskkey}  >/dev/null 2>&1 || leae "\nUnable to build task ${taskkey}."
        tfx build tasks upload --task-path ./_build/Tasks/${taskkey}  --proxy ${PROXY}  >/dev/null 2>&1 || leae "\nUnable to upload task ${taskkey} to the collection."
        log_success "Done\n"
    fi
done

log_info "Cleaning up..."
popd >/dev/null 2>&1
rm -rf $working_dir

log_success "Done\n"