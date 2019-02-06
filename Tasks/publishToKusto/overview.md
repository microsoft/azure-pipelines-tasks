# Unit testing

Install prerequisites:
```
npm install mocha --save-dev -g
```

Run the tests:
```
mocha publishToKusto\test\*.js
```

# Integration testing

To run the build task locally:

```
set INPUT_AADCLIENTID=23d5b01c-3789-435d-9040-97b5791763c8
set INPUT_AADCLIENTSECRET=<snip>
set INPUT_FILES=publishToKusto\test\**\*.csl
set INPUT_KUSTOCLUSTER=datastudiostreamtest.kusto.windows.net
set INPUT_KUSTODATABASE=test

node publishToKusto\src\index.js
```

# Build and publish

Install prerequisites:
```
npm i -g tfx-cli
```

Build and publish to https://genevaanalytics.visualstudio.com/ for testing:

```
tfx extension publish --manifest-globs vss-extension.test.json --share-with genevaanalytics --token <snip>
```

To obtain a Personal Access Token (PAT), go to https://genevaanalytics.visualstudio.com/_details/security/tokens.

The test extension is managed at https://marketplace.visualstudio.com/manage/publishers/genevaanalyticstest


Build and publish for prod:

```
tfx extension publish --manifest-globs vss-extension.json --share-with msazure --token <snip>
```

To share the build tasks with other VSTS accounts, go to https://marketplace.visualstudio.com/manage/publishers/genevaanalytics


# Azure Resources

Test AAD App:
https://ms.portal.azure.com/#blade/Microsoft_AAD_IAM/ApplicationBlade/objectId/f46cad46-9f39-49d6-860d-0e449fc86354/appId/23d5b01c-3789-435d-9040-97b5791763c8

Application Insights:
https://ms.portal.azure.com/#resource/subscriptions/ffda56d1-269a-4c11-b029-1dc15c42f928/resourcegroups/GenevaAnalyticsVstsBuildTasks/providers/microsoft.insights/components/GenevaAnalyticsVstsBuildTasks/overview

# References

## Microsoft docs

https://docs.microsoft.com/en-us/vsts/extend/develop/add-build-task
https://docs.microsoft.com/en-us/vsts/extend/develop/auth-schemes
https://docs.microsoft.com/en-us/vsts/extend/develop/service-endpoints

## Github

https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/stepbystep.md
https://github.com/Microsoft/vsts-tasks/tree/master/Tasks
https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/cURLUploader
