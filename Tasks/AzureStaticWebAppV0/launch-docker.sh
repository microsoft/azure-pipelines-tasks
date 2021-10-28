docker run \
    --env-file ./env.list \
    -v "$SWA_WORKING_DIR:$SWA_WORKSPACE_DIR" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient run