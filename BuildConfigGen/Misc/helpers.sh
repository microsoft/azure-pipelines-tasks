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