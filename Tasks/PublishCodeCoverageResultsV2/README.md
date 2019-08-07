# Publish Code Coverage Results

### Overview
The Publish Code Coverage Results task is used to publish the code coverage results of a build. 

### The different parameters of the task are explained below:

- **Code Coverage Tool:**	Required Field. The tool with which code coverage results are generated.

- **Summary File:**		Required Field. The path of the summary file containing code coverage statistics, such as line, method, and class coverage. The value may contain minimatch patterns. For example: `$(System.DefaultWorkingDirectory)/MyApp/**/site/cobertura/coverage.xml`

- **Report Directory:**		The path of the code coverage HTML report directory. The report directory is published for later viewing as an artifact of the build. The value may contain minimatch patterns. For example: `$(System.DefaultWorkingDirectory)/MyApp/**/site/cobertura`

- **Additional Files:**		The file path pattern specifying any additional code coverage files to be published as artifacts of the build. The value may contain minimatch patterns. For example: `$(System.DefaultWorkingDirectory)/**/*.exec`