function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   exit 1
}

../node_modules/.bin/tsc || failed 'Compilation failed.'
../_download/archive/*/*/bin/node gendocs.js