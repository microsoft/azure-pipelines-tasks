# Run Tests using Visual Studio task

### Overview

VSTest task can be used to run tests on Build agent machines. Apart from MSTest based tests, you can also run tests written using test frameworks like NUnit, xUnit, Mocha, Jasmine, etc. using the appropriate test adapters to Visual Studio. The task uses vstest.console.exe to execute tests and the command-line options available are documented [here](https://msdn.microsoft.com/en-us/library/jj155796.aspx) 

#### Execution Options

Use the following options to select tests and control how the tests are run

- **Test Assembly:** This is a required field. Use this to specify one or more test file names from which the tests should be picked. 
	*	Paths are relative to the 'Search Folder' input.
	*	Multiple paths can be specified, one on each line.
	*	Uses the minimatch patterns. Learn more about minimatch [here](https://aka.ms/minimatchexamples)
	
	Example 1:
	Most commonly your test projects follow a naming pattern such as `Product.Tests.dll`, `ProductTests.dll`, `Product.Test.dll`, `Product.UnitTests.dll` or similar. These dlls reside in your `bin` directory. To include all such test dlls use this pattern:
	
	```	
	**\bin\*test.dll
	**\bin\*tests.dll
	```

	Example 2:
	When it is impossible to determine a naming convention for the tested dlls a wide include pattern can be used (notice the * before .dll). Such pattern can be followed by exclude patterns (starting with `!`) that excludes additional dlls.
	This pattern includes all dlls that have `test` in their name, and excludes all dlls from intermediate build `obj` directory:
	
	```
	**\*test*.dll
	!**\obj\**
	```

	This pattern is likely to include more dlls than you expect as many other dll names include *test* in their name, such as `MSTest.TestFramework.dll`, `Microsoft.VisualStudio.TestPlatform.ObjectModel.dll` etc. Please review your test log to see which dlls are included, and add appropriate excludes, such as:

	```
	**\*test*.dll
	!**\obj\**
	!**\*.resources.dll
	!**\*TestAdapter.dll
	!**\*Microsoft.*TestPlatform*.dll
	!**\*testhost*.dll
	!**\testcentric.engine.metadata.dll
	```
	

- **Search Folder:** Use this to specify the folder to search for the test files. Defaults to `$(System.DefaultWorkingDirectory)`

- **Test Filter Criteria:** Filters tests from within the test assembly files. For example, “Priority=1 | Name=MyTestMethod”. This option works the same way as the console option /TestCaseFilter of vstest.console.exe

- **Run Settings File:** Path to a runsettings or testsettings file can be specified here. The path can be to a file in the repository or a path to file on disk. Use $(Build.SourcesDirectory) to access the root project folder. [Click here](https://msdn.microsoft.com/library/jj635153.aspx) for more information on these files.

- **Override TestRun Parameters:** Override parameters defined in the TestRunParameters section of the runsettings file. For example: Platform=$(platform);Port=8080
[Click here](https://blogs.msdn.com/b/visualstudioalm/archive/2015/09/04/supplying-run-time-parameters-to-tests.aspx) for more information on overriding parameters. 

- **Code Coverage Enabled:** If set, this will collect code coverage information during the run and upload the results to the server. This is supported for .Net and C++ projects only. [Click here](https://msdn.microsoft.com/library/jj159530.aspx) to learn more about how to customize code coverage and manage inclusions and exclusions. 

- **Run in Parallel:** If set, tests will run in parallel leveraging available cores of the machine. [Click here](https://aka.ms/paralleltestexecution) to learn more about how tests are run in parallel.

- **VSTest version:** Choose which version of Visual Studio (vstest.console.exe) to run tests with. 

- **Path to Custom Test Adapters:** Path to the testadapter for the framework in which the specified tests are written. Provided directory and all subdirectories are checked for testadapters. If there is a packages folder in the sources directory, it is automatically searched for testadapters. As a result, any testadapter downloaded as a Nuget package will be used without any input. For example, ‘$(Build.SourcesDirectory)\Fabrikam\packages’

- **Other console options:** Other options that can be provided to vstest.console.exe. For example, if you are using VSIX extensions, you can provide “/UseVsixExtensions:true”. These options are not supported and will be ignored when running tests using the ‘Multi agent’ parallel setting of an agent job or when running tests using ‘Test plan’ or 'Test run' option or when a custom batching option is selected. In these cases, the options can be specified using a runsettings file instead.

#### Test Impact Analysis 

- **Run Only Impacted Tests:** If set, then only the relevant set of managed automated tests that need to be run to validate a given code change will be run. 

- **Number Of Builds After Which To Run All Tests:** This is an override that can be used to set the periodicity at which to automatically run the complete automated test suite.

The Test Impact Analysis feature is available through the v2.\* (preview) version of the task.

The feature is presently scoped to the following:
- Dependencies
	- **Requires use of the v2.\* (preview) of the VSTest task in the build definition.**
	- **Requires VS 2015 Update 3 or VS 2017 RC and above on the build agent**
- Supported
	- Managed code
	- CI and in PR workflows
	- IIS interactions
	- Automated Tests (unit tests, functional tests) - the tests and the application must be running on the same machine.
	- Build vNext, with multiple Test Tasks
	- Local and Hosted build agents (you will need VS 2015 Update 3 or VS2017 RC and above – please see “Dependencies”)
	- Git, GitHub, External Git, TFVC repos
- Not yet  supported
	- Remote testing (where the test is exercising an app deployed to a different machine)
	- No xplat support (Windows only).
	- No UWP support.

	Learn more about Test Impact [here](https://aka.ms/tialearnmore)


#### Advanced Execution Options

- **Batch tests:** A batch is a group of tests. A batch of tests runs at a time and results are published for that batch. If the phase in which the task runs is set to use multiple agents, each agent picks up any available batches of tests to run in parallel. Choose one of the below mentioned options for batching.
	- **Based on number of tests and agents:** Simple batching based on the number of tests and agents participating in the test run.
	- **Based on past running time of tests:** This batching considers past running time to create batches of tests such that each batch has approximately equal running time.
	- **Based on test assemblies:** Tests from an assembly are batched together.

	Learn more about batching options [here](https://aka.ms/vstestbatchingoptions)

- **Do not distribute tests and replicate instead when multiple agents are used in the phase:** Choosing this option will not distribute tests across agents when the task is running in a multi-agent phase. Each of the selected test(s) will be repeated on each agent. The option is not applicable when the agent phase is configured to run with no parallelism or with the multi-config option.

#### Reporting Options
Use the following options to report desired information for the test run that can be used when analyzing runs. 

- **Test Run Title:** Provide a name for the test run. 

- **Platform:**	Build platform against which the test run should be reported. This field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, x64 or x86. If you have defined a variable for platform in your build task, use that here.

- **Configuration:** Build configuration against which the Test Run should be reported. Field is used for reporting purposes only. If you are using the Build – Visual Studio template, this is already defined for you. For example, Debug or Release. If you have defined a variable for configuration in your build task, use that here.

- **Upload test attachments:** If set, any test run level attachments such as the TRX file will be uploaded.
