#Build your code using Ant in VSTS

###Parameters for Ant build task are explained below

- **Ant Build File :** This is a Required field. Provide relative path from the repository root to the Ant build file. To know more [click here](http://ant.apache.org/manual/using.html#buildfile)

- **Options :** Provide any options to pass to the Ant command line. You can provide your own properties (for example, `-DmyProperty=myPropertyValue`) and also use built-in variables (for example, `-DcollectionId=$(system.collectionId)`). Alternatively, the built-in variables are already set as environment variables during the build and can be passed directly (for example, `-DcollectionIdAsEnvVar=%SYSTEM_COLLECTIONID%)` To know more [click here](http://ant.apache.org/manual/running.html#options)

- **Target(s) :** Provide The task(s) for Ant to execute for this build. To know more [click here](http://ant.apache.org/manual/targets.html#targets)

####JUnit Test Results
Use the next three options to manage your JUnit test results in VSTS

- **Publish to VSTS/TFS :** Select this option to publish JUnit Test results produced by the Ant build to Visual Studio Team Services/TFS. Each test result file matching `Test Results Files` will be published as a test run in VSTS.

- **Test Results Files :** This option will appear if you select the above option. Here, provide Test results files path. Wildcards can be used. For example, `**/TEST-*.xml` for all xml files whose name starts with `TEST-."`

- **Test Run Title :** This option will appear if you select the `Publish to VSTS/TFS` option. Here provide a name for the Test Run

####Code Coverage
Use the next options to manage your code coverage options. If your Build file already has Code Coverage enabled, you can ignore this section and use the Publish Code Coverage task to upload results to TFS/VSTS

- **CodeCoverage Tool :** Select the code coverage tool you want to use. Currently JaCoCo and Cobertura are supported. For JaCoCo, make sure `jacocoant.jar` is available in lib folder of Ant installation. For Cobertura, set up an environment variable `COBERTURA_HOME` pointing to the Cobertura jars location.  [Click here](http://www.eclemma.org/jacoco/trunk/doc/ant.html) to know more about Jacoco and [Click here](https://github.com/cobertura/cobertura/wiki/Ant-Task-Reference) to know more about Cobertura.

- **Class Files Directories :** Provide comma separated list of relative paths from Ant build file to directories containing class files, archive files(jar, war etc.). Code coverage is reported for class files present in the directories. Directories and archives are searched recursively for class files. For example: target/classes,target/testClasses.

- **Class Inclusion/Exclusion Filters :** This option is enabled only when you select one tool in the above option. Provide a 
comma separated list of filters to include or exclude classes from collecting code coverage. For example: +:com.*,+:org.*,-:my.app*.*.

- **Source Files Directories :** Provide comma separated list of relative paths from Ant build file to source directories. Code coverage reports will use these to highlight source code. For example: src/java,src/Test.

####Advanced
Use the next options to manage your `ANT_HOME` and `JAVA_HOME` attributes

- **Set ANT_HOME Path :** If set, overrides any existing `ANT_HOME` environment variable with the given path.

- **Set JAVA_HOME by :** Select to set `JAVA_HOME` either by providing a path or let VSTS set the `JAVA_HOME` based on JDK version choosen. By default it is set to `JDK Version`

- **JDK Version/Path :** Here provide the PATH to `JAVA_HOME` if you want to set it by path or select the appropriate JDK version.

- **JDK Architecture :** Select the approriate JDK Architecture. By default it is set to `x86`

