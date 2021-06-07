workspace="/working_dir"

params=()

[[ ! -z "$SWA_APP_LOCATION" ]] && params+=(-e "APP_LOCATION=$SWA_APP_LOCATION")
[[ ! -z "$SWA_APP_BUILD_COMMAND" ]] && params+=(-e "APP_BUILD_COMMAND=$SWA_APP_BUILD_COMMAND")
[[ ! -z "$SWA_OUTPUT_LOCATION" ]] && params+=(-e "OUTPUT_LOCATION=$SWA_OUTPUT_LOCATION")
[[ ! -z "$SWA_API_LOCATION" ]] && params+=(-e "API_LOCATION=$SWA_API_LOCATION")
[[ ! -z "$SWA_API_BUILD_COMMAND" ]] && params+=(-e "API_BUILD_COMMAND=$SWA_API_BUILD_COMMAND")
[[ ! -z "$SWA_ROUTES_LOCATION" ]] && params+=(-e "ROUTES_LOCATION=$SWA_ROUTES_LOCATION")
[[ ! -z "$SWA_BUILD_TIMEOUT_IN_MINUTES" ]] && params+=(-e "BUILD_TIMEOUT_IN_MINUTES=$SWA_BUILD_TIMEOUT_IN_MINUTES")

params+=(-e "VERBOSE=$SWA_VERBOSE")
params+=(-e "SKIP_APP_BUILD=$SWA_SKIP_APP_BUILD")

docker run \
    -e DEPLOYMENT_TOKEN="$SWA_API_TOKEN" \
    -e REPOSITORY_BASE=$workspace \
    -e DEPLOYMENT_PROVIDER=DevOps \
    -e REPOSITORY_URL="$BUILD_REPOSITORY_URI" \
    -e BRANCH="$BUILD_SOURCEBRANCHNAME" \
    -e DEPLOYMENT_ACTION=upload \
    "${params[@]}" \
    -v "$BUILD_SOURCESDIRECTORY:$workspace" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient run