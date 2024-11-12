# Build your Java code using Maven in Azure Pipelines

### Parameters for Maven build task are explained below

- **Maven POM file :** This is a Required field. Provide relative path from the repo root to the Maven POM .xml file. [Click here to know more about POM] (https://maven.apache.org/guides/introduction/introduction-to-the-pom.html)

- **Options :** Specify any Maven options you want to use

- **Goal(s) :** In most cases, set this to `package` to compile your code and package it into a .war file. If you leave this argument blank, the build will fail. [Click here to know more about Maven Build Lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)

#### JUnit Test Results
Use the next three options to manage your JUnit test results in Azure Pipelines

- **Publish to Azure Pipelines/TFS :** Select this option to publish JUnit Test results produced by the Maven build to Azure Pipelines/TFS. Each test result file matching `Test Results Files` will be published as a test run in Azure Pipelines/TFS.

- **Test Results Files :** This option will appear if you select the above option. Here, provide Test results files path. Wildcards can be used. For example, `**/TEST-*.xml` for all xml files whose name starts with `TEST-."`. Defaults to `$(System.DefaultWorkingDirectory)`

- **Test Run Title :** This option will appear if you select the `Publish to Azure Pipelines/TFS` option. Here provide a name for the Test Run

#### Advanced
Use the next options to manage your `JAVA_HOME` attribute by JDK Version and Path

- **Set JAVA_HOME by :** Select to set `JAVA_HOME` either by providing a path or let Azure Pipelines set the `JAVA_HOME` based on JDK version choosen. By default it is set to `JDK Version`

- **JDK Version :** Here provide the PATH to `JAVA_HOME` if you want to set it by path or select the appropriate JDK verision.

- **JDK Architecture :** Select the approriate JDK Architecture. By default it is set to `x86`

#### Code Analysis

- **Run SonarQube Analysis :** You can choose to run SonarQube analysis after executing the current goals. 'install' or 'package' goals should be executed first. To know more about this option [click here](https://blogs.msdn.com/b/visualstudioalm/archive/2015/10/08/the-maven-build-task-now-simplifies-sonarqube-analysis.aspx)

- **Run Checkstyle :** You can choose to run the Checkstyle static code analysis tool, which checks the compliance of your source code with coding rules. You will receive a code analysis report with the number of violations detected, as well as the original report files if there were any violations.

- **Run PMD :** You can choose to run the PMD static code analysis tool, which examines your source code for possible bugs. You will receive a code analysis report with the number of violations detected, as well as the original report files if there were any violations.

- **Run FindBugs :** You can choose to run the FindBugs static code analysis tool, which examines the bytecode of your program for possible bugs. You will receive a code analysis report with the number of violations detected, as well as the original report files if there were any violations.











