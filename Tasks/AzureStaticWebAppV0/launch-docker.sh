workspace="/working_dir"
mount_dir=$SYSTEM_DEFAULTWORKINGDIRECTORY
[[ -n "$SWA_WORKING_DIR" ]] && mount_dir=$SWA_WORKING_DIR

params=()

[[ ! -z "$SWA_APP_LOCATION" ]] && params+=(-e "INPUT_APP_LOCATION=$SWA_APP_LOCATION")
[[ ! -z "$SWA_APP_BUILD_COMMAND" ]] && params+=(-e "INPUT_APP_BUILD_COMMAND=$SWA_APP_BUILD_COMMAND")
[[ ! -z "$SWA_OUTPUT_LOCATION" ]] && params+=(-e "INPUT_OUTPUT_LOCATION=$SWA_OUTPUT_LOCATION")
[[ ! -z "$SWA_API_LOCATION" ]] && params+=(-e "INPUT_API_LOCATION=$SWA_API_LOCATION")
[[ ! -z "$SWA_API_BUILD_COMMAND" ]] && params+=(-e "INPUT_API_BUILD_COMMAND=$SWA_API_BUILD_COMMAND")
[[ ! -z "$SWA_ROUTES_LOCATION" ]] && params+=(-e "INPUT_ROUTES_LOCATION=$SWA_ROUTES_LOCATION")

params+=(-e "INPUT_SKIP_APP_BUILD=$SWA_SKIP_APP_BUILD")

docker run \
    -e INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN="$SWA_API_TOKEN" \
    -e GITHUB_WORKSPACE=$workspace \
    -e DEPLOYMENT_PROVIDER=DevOps \
    -e REPOSITORY_URL="$BUILD_REPOSITORY_URI" \
    -e IS_PULL_REQUEST=false \
    -e BASE_BRANCH="$BUILD_SOURCEBRANCHNAME" \
    "${params[@]}" \
    -v "$mount_dir:$workspace" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient upload