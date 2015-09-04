# Run Tests using Visual Studio task

###Overview
VSTest task can be used to run tests on Build agent machines. Using the appropriate test adapters to Visual Studio, you can run tests written using test frameworks like MSTest, NUnit, xUnit, Mocha and Jasmine. The task uses vstest.console.exe to execute tests which is documented at https://msdn.microsoft.com/en-us/library/jj155796.aspx 

###The different parameters of the task are explained below:

- **Test Assembly:** Required Field. This field specifies the test assemblies(s) from which the tests should be picked. 
	*	Wildcards can be used
	*	Multiple paths can be specified separated by a semicolon
	*	Paths are relative to the Sources Directory

For example, `**\commontests\*test*.dll; **\frontendtests\*test*.dll;-:**\obj\**`

Include patterns start with ‘+:’, and exclude patterns with ‘-:’ (Default is include). For Javascript tests, this will point to .js files containing the tests

- **Test Filter Criteria:**	Filters tests from within the test assembly files. For example, “Priority=1 | Name=MyTestMethod”. This option works the same way as the console option /TestCaseFilter of vstest.console.exe

- **Platform:**	Build Platform against which the Test Run should be reported. Field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, x64 or x86. If you have defined a variable for platform in your Build task, use that here.

- **Configuration:**	Build Configuration against which the Test Run should be reported. Field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, Debug or Release. If you have defined a variable for configuration in your Build task, use that here.

- **Run Settings File:**	Path to a runsettings or testsettings file can be specified here. The path can be to a file in the repository or a path to file on disk. Use $(Build.SourcesDirectory) to access the root project folder. For more information on these files, please see https://msdn.microsoft.com/library/jj635153.aspx

- **Override TestRun Parameters:**	Override parameters defined in the TestRunParameters section of the runsettings file. For example: Platform=$(platform);Port=8080
For more information, please see http://blogs.msdn.com/b/visualstudioalm/archive/2015/09/04/supplying-run-time-parameters-to-tests.aspx

- **Code Coverage Enabled:**	If set, this will collect code coverage information during the run and upload the results to the server. This is supported for .net and C++ projects only. To customize Code Coverage analysis and manage inclusions and exclusions, please see https://msdn.microsoft.com/library/jj159530.aspx
	
- **VSTest version:**	Combo box to choose which version of Visual Studio (vstest.console.exe) to run tests with. Default value is Visual Studio 2015.
	
- **Path to Custom Test Adaptors:**	Path to the testadapter for the framework in which the tests are written. Provided directory and all subdirectories are checked for testadapters. If there is a packages folder in the sources directory, it is automatically searched for testadapters. Hence, any testadapter downloaded as a Nuget package will be used without any input. For example, ‘$(Build.SourcesDirectory)\Fabrikam\packages’

- **Other console options:**	Other options that can be provided to vstest.console.exe. For example, if you are using vsix extensions, you can provide “/UseVsixExtensions:true”


