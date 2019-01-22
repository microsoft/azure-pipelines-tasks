# Run Functional Tests Task

### Overview
The Run Functional Tests task should be used when you want to run tests on one or more remote machines and you cannot run tests on build machine. Typical scenarios – tests that require additional installations on the test machines like different browsers for Selenium tests, running Coded UI Tests or a specific OS configuration or execute lots of unit tests faster on multiple machines etc. You can run unit tests, integration tests, functional tests – any test that you can run using vstest.console.exe can be run using this task. To use this task, *it needs to be preceded with “Visual Studio Test Agent Deployment” task*.
To learn more about the general usage of the task, please see https://msdn.microsoft.com/en-us/library/mt270062.aspx and https://blogs.msdn.com/b/visualstudioalm/archive/2015/06/28/10618066.aspx

### The different parameters of the task are explained below:

#### Setup Options
- **Machines:**	Required Field. Provide a comma separated list of machine names or "Azure Resource Group" name or Variable name containing the list of machines which should be used to run tests.

- **Test drop location:** Required Field. Location on the test machine(s) where the test binaries have been copied to.  ‘Windows Machine File Copy’ task or ‘Azure File Copy’ task (for Azure machines) can be used to copy the test binaries. System Environment Variables from the agent machines can also be used in specifying the drop location. For example, c:\tests or %systemdrive%\Tests

#### Execution Options
- **Test selection:** You can run tests by specifying test files and assemblies or using Test Plan/Test Suite.

- **Test assembly:** Required Field. This field specifies the test assemblies from which the tests should be picked.
	*	Wildcards can be used
	*	Multiple paths can be specified separated by a semicolon
	*	Paths are relative to the root directory of the test drop location

For example, `**\commontests\*test*.dll; **\frontendtests\*test*.dll;`


- **Test filter criteria:**	Filters tests from within the test assembly files. For example, “Owner=james&Priority=1”. This option works the same way as the console option /TestCaseFilter for vstest.console.exe
For more information, see https://msdn.microsoft.com/en-us/library/jj155796.aspx

- **Test plan:** Select the test plan.

- **Test suite:** Select one or more test suites within the test plan that contains automated tests.

- **Test configuration:** Select a test configuration to report against.

- **Run settings file:** File Path to a runsettings or testsettings file can be specified here. The path can be to a file in the repository or a path to a file on the Build Agent machine. Use $(Build.SourcesDirectory) to access the root project folder. For more information on these files, please see https://msdn.microsoft.com/library/jj635153.aspx

- **Override testrun parameters:** Override parameters defined in the TestRunParameters section of the runsettings file. For example: Platform=$(platform);Port=8080
For more information, please see https://blogs.msdn.com/b/visualstudioalm/archive/2015/09/04/supplying-run-time-parameters-to-tests.aspx

- **Code coverage enabled:**	If set, this will collect code coverage information during the run and upload the results to the server. This is supported for .net and C++ projects only. To customize Code Coverage analysis and manage inclusions and exclusions, please see https://msdn.microsoft.com/library/jj159530.aspx

- **Distribute tests based on:** Specify how the tests should be distributed.

#### Reporting Options
-**Test run title:** Provide a name for the test run.

- **Build platform:**	Build Platform against which the Test Run should be reported. Field is used for reporting purposes only. For example, x64 or x86. If you are using the Deployment – Build, Deploy and Distributed Test template, this is already defined for you. Alternatively, if you have defined a variable for platform in your Build task, use that here.

- **Build configuration:**	Build Configuration against which the Test Run should be reported. Field is used for reporting purposes only. For example, Debug or Release. If you are using the Deployment – Build, Deploy and Distributed Test template, this is already defined for you. Alternatively, if you have defined a variable for Configuration in your Build task, use that here.

- **Test configurations:**	Report the configuration on which the Test case was run. Field is used for reporting purposes only. Syntax: <Expression for Test method name(s)> : <Configuration ID from MTM>.
For example, FullyQualifiedName~Chrome:12 will report all test methods which have Chrome in their Fully Qualified name and map them to Configuration ID 12 defined in MTM. Use DefaultTestConfiguration:<Id> as a catch all

- **Application under test machines:**	Machine(s) on which the Application Under Test is deployed. This is used to collect Code Coverage data from those machines. Use this in conjunction with Code Coverage Enabled checkbox.

Note: There is no explicit field to specify path to test adapters in the task. The task automatically searches for "packages" directory that exists in the same folder as the .sln file (nuget restored directory structure). If your adapters are in a different directory or you did not copy over the source files, use a runsettings file with TestAdaptersPaths as described at https://msdn.microsoft.com/en-us/library/jj635153.aspx


### Scenarios Supported
Here is a high level list of the topology support using this task:

1.	Running automated tests against on-premise standard environments
2.	Running automated tests against existing azure environments
3.	Running automated tests against newly provisioned azure environments

### This is the supported matrix for the scenarios above:
-	**TFS**

	a.	On Premise and VS Online

-	**BuildAgents**

	a.	Both Hosted as well as Onpremise BuildAgents are supported.

	b.	Using crossplat agent for any BDT tasks is not supported.

	c.	BuildAgent must be able to communicate with all test machines, and thus if test machines are on-premise, hosted build agent pool (in case of VS Online) can't be used.

	d.	BuildAgent should have internet access to download test agents.
If this is not the case, testagent should be manually downloaded from official msdn page, uploaded to a network location accessible by build agent, and then used in DeployTestAgent task via "custom test agent location" parameter. However if there is a new version of TestAgent available, the onus is on the user to repeat the same process again to update the test machines. Details provided in the help section for the Test Agent Deployment task.

-	**CI/CD workflow**

	a.	The BDT tasks are supported in both Build and RM workflow

-	**Machine group configuration**

	a.	To use BDT, only Windows OS based machines are supported inside a machine group. Adding Linux/IOS or other platforms inside machines groups and using BDT tasks is not supported.

	b.	Installing any VisualStudio SKU on any of the test machines is not supported.

	c.	Similarly installing any older version of TestAgent on any of the test machines is not supported.

-	**Test machine topologies**

	a.	Azure based test machines are fully supported - both existing test machines, and newly provisioned ones.

	b.	TestAgent machines must have network access to the TFS instance in use. Because of this network isolated test machines are not supported.

	c.	Domain joined machines are supported.

	d.	For workgroup joined testmachines, https authentication must be enabled and configured during machine group creation.

-	**Usage Error Conditions**

	a.	Using same test machines across different machine groups, and running builds (with any BDT tasks) parallelly against those machine groups is not supported.

	b.	Cancelling an inprogress build/release with BDT tasks is not supported. If you do cancel, your subsequent builds may misbehave.

	c.	Cancelling an ongoing test run queued via BDT tasks is not supported.

	d.	Configuring Testagent and running tests as a non-admin/service account is not supported.

	e.	Running tests for Universal Windows Platform apps is not supported. Please use Visual Studio Test task for running these tests.

### Here is a list of other tasks that can be used with this task in the Build-Deploy-Test (BDT) workflow:

1.	*Deploy Azure Resource Group*: https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureResourceGroupDeploymentV2
2.	*Azure File Copy*: https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureFileCopyV2
3.	*Windows Machine File Copy*: https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/WindowsMachineFileCopyV2
4.	*PowerShell on Target Machines*: https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/PowerShellOnTargetMachinesV3
5.	*Deploy Visual Studio Test Agent*: https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DeployVisualStudioTestAgentV2

<br/>
