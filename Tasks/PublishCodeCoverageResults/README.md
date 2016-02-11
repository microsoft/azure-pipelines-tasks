# Publish Code Coverage Results

###Overview
The Publish Code Coverage Results task is used to publish the code coverage results to VSO/TFS. 

###The different parameters of the task are explained below:

- **Code Coverage Tool:**	Required Field. Name of the tool used to generate code coverage summary files.

- **Summary File:**		Required Field. Path of code coverage summary file, which has code coverage statistics like line, method, class coverage.

- **Report Directory:**		Path of code coverage report directory. The report directory is published as an artifact against the build.

- **Additional Files:**		Regular expression specifying the additional code coverage files to be published as an artifact against the build.