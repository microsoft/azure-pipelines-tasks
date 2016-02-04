#Build your Java code using Maven in VSTS

###Parameters for Maven build task are explained below

- **Maven POM file :** This is a Required field. Provide relative path from the repo root to the Maven POM .xml file. [Click here to know more about POM] (http://maven.apache.org/guides/introduction/introduction-to-the-pom.html)

- **Options :** Specify any Maven options you want to use

- **Goal(s) :** In most cases, set this to `package` to compile your code and package it into a .war file. If you leave this argument blank, the build will fail. [Click here to know more about Maven Build Lifecycle](http://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)

####JUnit Test Results
Use the next three options to manage your JUnit test results in VSTS

- **Publish to VSTS/TFS :** Select this option to publish JUnit Test results produced by the Maven build to Visual Studio Team Services/TFS. Each test result file matching `Test Results Files` will be published as a test run in VSTS/TFS.

- **Test Results Files :** This option will appear if you select the above option. Here, provide Test results files path. Wildcards can be used. For example, `**/TEST-*.xml` for all xml files whose name starts with `TEST-."`

- **Test Run Title :** This option will appear if you select the `Publish to VSTS/TFS` option. Here provide a name for the Test Run

####Code Coverage
Use the next options to manage your code coverage options. If your Build file already has Code Coverage enabled, you can ignore this section and use the Publish Code Coverage task to upload results to TFS/VSTS

- **CodeCoverage Tool :** Select the code coverage tool you want to use. Currently JaCoCo and Cobertura are supported. [Click here](http://eclemma.org/jacoco/trunk/doc/maven.html) to know more about Jacoco and [Click here](http://www.mojohaus.org/cobertura-maven-plugin/index.html) to know more about Cobertura.

- **Class Inclusion/Exclusion Filters :** This option is enabled only when you select one tool in the above option. Provide a 
comma separated list of filters to include or exclude classes from collecting code coverage. For example: +:com.*,+:org.*,-:my.app*.*. 
- **Class Files Directories :** This option is enabled only when you select JaCoCo as code coverage tool. This field is required for a multi module project. Specify comma separated list of relative paths from Maven POM file to directories containing class files, archive files(jar, war etc.). Code coverage is reported for class files present in the directories. For example: target/classes,target/testClasses.

- **Source Files Directories :** This option is enabled only when you select JaCoCo as code coverage tool. This field is required for a multi module project. Specify comma separated list of relative paths from Maven POM file to source directories. Code coverage reports will use these to highlight source code. For example: src/java,src/Test.

####Advanced
Use the next options to manage your `JAVA_HOME` attribute by JDK Version and Path

- **Set JAVA_HOME by :** Select to set `JAVA_HOME` either by providing a path or let VSTS set the `JAVA_HOME` based on JDK version choosen. By default it is set to `JDK Version`

- **JDK Version :** Here provide the PATH to `JAVA_HOME` if you want to set it by path or select the appropriate JDK verision.

- **JDK Architecture :** Select the approriate JDK Architecture. By default it is set to `x86`

####SonarQube Analysis

- **Run SonarQube Analysis :** You can choose to run SonarQube analysis after executing the current goals. 'install' or 'package' goals should be executed first. To know more about this option [click here](http://blogs.msdn.com/b/visualstudioalm/archive/2015/10/08/the-maven-build-task-now-simplifies-sonarqube-analysis.aspx)











