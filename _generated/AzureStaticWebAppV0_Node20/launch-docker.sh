docker run \
    --env-file ./env.list \
    --pull=always \
    -v "$SWA_WORKING_DIR:$SWA_WORKSPACE_DIR" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient run