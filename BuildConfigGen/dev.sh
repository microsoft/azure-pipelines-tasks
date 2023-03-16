function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   popd
   exit 1
}

function heading()
{
    echo
    echo
    echo "-----------------------------------------"
    echo "  ${1}"
    echo "-----------------------------------------"
}


function detect_platform ()
{
    heading "Platform / RID detection"

    CURRENT_PLATFORM="windows"
    if [[ ($(uname) == "Linux") || ($(uname) == "Darwin") ]]; then
        CURRENT_PLATFORM=$(uname | awk '{print tolower($0)}')
    fi
}

function cmd_build ()
{
    heading "Building"
    dotnet build -o bin $SOLUTION_PATH || failed build
    #change execution flag to allow running with sudo
    if [[ ("$CURRENT_PLATFORM" == "linux") || ("$CURRENT_PLATFORM" == "darwin") ]]; then
        chmod +x "/bin/BuildConfigGen"
    fi

}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd "$SCRIPT_DIR"

SOLUTION_PATH="$SCRIPT_DIR/BuildConfigGen.sln"
detect_platform
cmd_build