# Run Tests using Visual Studio task

###Overview
VSTest task can be used to run tests on Build agent machines. Apart from MSTest based tests, you can also run tests written using test frameworks like NUnit, xUnit, Mocha, Jasmine, etc. using the appropriate test adapters to Visual Studio. The task uses vstest.console.exe to execute tests and the command-line options available are documented [here](https://msdn.microsoft.com/en-us/library/jj155796.aspx) 

####Execution Options
Use the following options to select tests and control how the tests are run

- **Test Assembly:** This is a required field. Use this to specify one or more test file names from which the tests should be picked. 
	*	Paths are relative to the 'Search Folder' input.
	*	Multiple paths can be specified, one on each line.
	*	Uses the minimatch patterns. Learn more about minimatch [here](https://aka.ms/minimatchexamples)
	
	For example:
	To run tests from any test assembly that has 'test' in the assembly name, `**\*test*.dll`.
	To exclude tests in any folder called `obj`, `!**\obj\**`. 

- **Search Folder:** Use this to specify the folder to search for the test files. Defaults to `$(System.DefaultWorkingDirectory)`

- **Test Filter Criteria:** Filters tests from within the test assembly files. For example, “Priority=1 | Name=MyTestMethod”. This option works the same way as the console option /TestCaseFilter of vstest.console.exe

- **Run Settings File:** Path to a runsettings or testsettings file can be specified here. The path can be to a file in the repository or a path to file on disk. Use $(Build.SourcesDirectory) to access the root project folder. [Click here](https://msdn.microsoft.com/library/jj635153.aspx) for more information on these files.

- **Override TestRun Parameters:** Override parameters defined in the TestRunParameters section of the runsettings file. For example: Platform=$(platform);Port=8080
[Click here](https://blogs.msdn.com/b/visualstudioalm/archive/2015/09/04/supplying-run-time-parameters-to-tests.aspx) for more information on overriding parameters. 

- **Code Coverage Enabled:** If set, this will collect code coverage information during the run and upload the results to the server. This is supported for .Net and C++ projects only. [Click here](https://msdn.microsoft.com/library/jj159530.aspx) to learn more about how to customize code coverage and manage inclusions and exclusions. 

- **Run in Parallel:** If set, tests will run in parallel leveraging available cores of the machine. [Click here](https://aka.ms/paralleltestexecution) to learn more about how tests are run in parallel.

####Test Impact Analysis 

- **Run Only Impacted Tests:** If set, then only the relevant set of managed automated tests that need to be run to validate a given code change will be run. 

- **Number Of Builds After Which To Run All Tests:** This is an override that can be used to set the periodicity at which to automatically run the complete automated test suite.

####Advanced Execution Options

- **VSTest version:** Choose which version of Visual Studio (vstest.console.exe) to run tests with. 

- **Path to Custom Test Adapters:** Path to the testadapter for the framework in which the specified tests are written. Provided directory and all subdirectories are checked for testadapters. If there is a packages folder in the sources directory, it is automatically searched for testadapters. As a result, any testadapter downloaded as a Nuget package will be used without any input. For example, ‘$(Build.SourcesDirectory)\Fabrikam\packages’

- **Other console options:** Other options that can be provided to vstest.console.exe. For example, if you are using VSIX extensions, you can provide “/UseVsixExtensions:true”

####Reporting Options
Use the following options to report desired information for the test run that can be used when analyzing runs. 

- **Test Run Title:** Provide a name for the test run. 

- **Platform:**	Build platform against which the test run should be reported. This field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, x64 or x86. If you have defined a variable for platform in your build task, use that here.

- **Configuration:** Build configuration against which the Test Run should be reported. Field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, Debug or Release. If you have defined a variable for configuration in your build task, use that here.

- **Upload test attachments:** If set, any test run level attachments such as the TRX file will be uploaded.	



