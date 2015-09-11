# Deploy Visual Studio Agent Task

###Overview
The Deploy Test agent task is used to Deploy the Test Agent to a set of machines. This Test Agent can then be used to enable data collection or run Distributed Tests using the ‘Visual Studio Test using Test Agent’ task. 
To learn more about the general usage of the task, please see https://msdn.microsoft.com/en-us/library/mt270062.aspx and http://blogs.msdn.com/b/visualstudioalm/archive/2015/06/28/10618066.aspx

###The different parameters of the task are explained below:

- **Test Machine Group / Azure Resource Group:**	Required Field. Name of the Test Machine Group or Azure Resource Group on which the Test Agent should be deployed. Click on ‘Manage’ to navigate to the Machine Group page and create/manage your machine groups.    

- **Filter Criteria:**	Subset of machines from the Machine Group or Resource group specified on which the Test Agent should be deployed. Using the radio buttons above (Select Machines By), you can choose to specify this filter by Machine Names or Tags. Tags can be given to machines when creating a Machine Group.

- **Username:**	Required Field. Specify a username that the Test Agent will use. Username should be an admin on the Test Machines on which Test Agent is being deployed. Multiple formats like Domain\username, username, Machinename\username and .\username are supported. Note that UPN format like username@domain.com and built in System accounts like “NT Authority\System” are not supported

- **Password:**	Required Field. Password for the username given above. To encrypt your password, create a secret variable in the variables tab and use that variable here

- **Interactive Process:**	Select to indicate that the Test Agent should run as an interactive process. This is required when you are dealing with UI elements or starting applications during your tests. 

For example, Coded UI or Selenium tests that are running on full fidelity browsers would need this checked.

- **Test Agent Location:**	Use this to supply a path to the Test Agent (vstf_testagent.exe) which is different from the default (http://go.microsoft.com/fwlink/?LinkId=536423). You can specify a local path or a network location. 

- **Update Test Agent:**	If Test Agent is already deployed on a machine, this option checks to see if there is an update available for that version of the Test Agent. Unchecking the box will skip the update check

- **Enable Data Collection Only:**	Checking this box will prevent tests from running on these set of machines. This is useful for scenarios where you only want to enable data collection, like Code Coverage data, from a set of machines.

For example, in a client-server application model, you would use this option to deploy a smaller footprint Test Agent on the server machines and use another deploy task to deploy the full Test Agent to test machines. This will enable you to collect data from both Server and client machines

<br/>
