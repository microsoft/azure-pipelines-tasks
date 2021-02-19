workspace="/working_dir"

params=()

[[ ! -z "$SWA_APP_LOCATION" ]] && params+=(-e "INPUT_APP_LOCATION=$SWA_APP_LOCATION")
[[ ! -z "$SWA_APP_BUILD_COMMAND" ]] && params+=(-e "INPUT_APP_BUILD_COMMAND=$SWA_APP_BUILD_COMMAND")
[[ ! -z "$SWA_OUTPUT_LOCATION" ]] && params+=(-e "INPUT_OUTPUT_LOCATION=$SWA_OUTPUT_LOCATION")
[[ ! -z "$SWA_API_LOCATION" ]] && params+=(-e "INPUT_API_LOCATION=$SWA_API_LOCATION")
[[ ! -z "$SWA_API_BUILD_COMMAND" ]] && params+=(-e "INPUT_API_BUILD_COMMAND=$SWA_API_BUILD_COMMAND")
[[ ! -z "$SWA_ROUTES_LOCATION" ]] && params+=(-e "INPUT_ROUTES_LOCATION=$SWA_ROUTES_LOCATION")

docker run \
    -e INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN="$azure_static_web_apps_api_token" \
    -e GITHUB_WORKSPACE=$workspace \
    -e DEPLOYMENT_PROVIDER=DevOps \
    -e REPOSITORY_URL="$BUILD_REPOSITORY_URI" \
    -e IS_PULL_REQUEST=false \
    -e BASE_BRANCH="$BUILD_SOURCEBRANCHNAME" \
    "${params[@]}" \
    -v "$BUILD_SOURCESDIRECTORY:$workspace" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient upload