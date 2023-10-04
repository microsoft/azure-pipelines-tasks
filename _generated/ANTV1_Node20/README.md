# Build your code using Ant in Azure Pipelines

### Parameters for Ant build task are explained below

- **Ant Build File :** This is a Required field. Provide relative path from the repository root to the Ant build file. To know more [click here](https://ant.apache.org/manual/using.html#buildfile)

- **Options :** Provide any options to pass to the Ant command line. You can provide your own properties (for example, `-DmyProperty=myPropertyValue`) and also use built-in variables (for example, `-DcollectionId=$(system.collectionId)`). Alternatively, the built-in variables are already set as environment variables during the build and can be passed directly (for example, `-DcollectionIdAsEnvVar=%SYSTEM_COLLECTIONID%)` To know more [click here](https://ant.apache.org/manual/running.html#options)

- **Target(s) :** Provide The task(s) for Ant to execute for this build. To know more [click here](https://ant.apache.org/manual/targets.html#targets)

#### JUnit Test Results
Use the next three options to manage your JUnit test results in Azure Pipelines

- **Publish to Azure Pipelines/TFS :** Select this option to publish JUnit Test results produced by the Ant build to Azure Pipelines/TFS. Each test result file matching `Test Results Files` will be published as a test run in Azure Pipelines.

- **Test Results Files :** This option will appear if you select the above option. Here, provide Test results files path. Wildcards can be used. For example, `**/TEST-*.xml` for all xml files whose name starts with `TEST-."`

- **Test Run Title :** This option will appear if you select the `Publish to Azure Pipelines/TFS` option. Here provide a name for the Test Run

#### Advanced
Use the next options to manage your `ANT_HOME` and `JAVA_HOME` attributes

- **Set ANT_HOME Path :** If set, overrides any existing `ANT_HOME` environment variable with the given path.

- **Set JAVA_HOME by :** Select to set `JAVA_HOME` either by providing a path or let Azure Pipelines set the `JAVA_HOME` based on JDK version choosen. By default it is set to `JDK Version`

- **JDK Version/Path :** Here provide the PATH to `JAVA_HOME` if you want to set it by path or select the appropriate JDK version.

- **JDK Architecture :** Select the approriate JDK Architecture. By default it is set to `x86`

**We are discontinuing the support of automated Code Coverage report generation for Ant projects starting Sprint 107 deployment of Azure Pipelines and for Team Foundation Server “15”. Please enable Code Coverage in your Ant build.xml file manually.**
