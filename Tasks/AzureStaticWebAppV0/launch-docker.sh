workspace="/working_dir"
mount_dir=$SYSTEM_DEFAULTWORKINGDIRECTORY
[[ -n "$SWA_WORKING_DIR" ]] && mount_dir=$SWA_WORKING_DIR

docker run \
    -e REPOSITORY_BASE=$workspace \
    -e DEPLOYMENT_PROVIDER=DevOps \
    -e REPOSITORY_URL="$BUILD_REPOSITORY_URI" \
    -e BRANCH="$BUILD_SOURCEBRANCHNAME" \
    -e DEPLOYMENT_ACTION=upload \
    --env-file ./env.list \
    -v "$mount_dir:$workspace" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient run