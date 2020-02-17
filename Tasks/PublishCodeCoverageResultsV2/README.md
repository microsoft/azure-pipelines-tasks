# Publish Code Coverage Results

### Overview
The Publish Code Coverage Results task is used to publish the code coverage results of a build. 

### The different parameters of the task are explained below:

- **Summary Files:**		Required Field. The path pattern for summary files containing code coverage statistics, such as line, method, and class coverage. The value may contain minimatch patterns as well as multiline inputs. For example: `$(System.DefaultWorkingDirectory)/MyApp/**/site/cobertura/*.xml`

- **Path to Source Files:**		The file path specifying the location of source files, this is required for generating HTML reports in case of tools which put relative paths in their summary files.

- **Fail when code coverage files are not found:**		Fail the task if the summary file patterns yielded no coverage files.