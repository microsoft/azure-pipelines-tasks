# Perform Action On Machine Group Task

### Overview

The task is used to start/stop/restart/delete/Block/Unblock Azure Resource Groups. 

### The different parameters of the task are as described below:

- **Azure Subscription:** The Azure Subscription, where the resource group is located.
- **Machine Group:** The name of the Azure resource group.
- **Action:** The action to be performed on the resource group wiz. start, stop, restart, Block, Unblock or delete. If Block action selected then following more parameters need to be filled:
	- **Block For:** Block a machine group either for an instance like a particular Build, or for the definition i.e. for all the instances of the definition. By Default Machine group will be blocked for definition.
	- **Time in Hours:** The number of hours that the machines will be blocked for. Value 0 indicates that the machines will be blocked indefinitely.
	- **Wait Time in Minutes(if blocked):** If machine group is already blocked, the number of minutes to wait for the machine group to get unblocked. Default is 30 minutes
- **Select Machines By:** The parameter is used to specify the subset of VMs on which the action will be performed, and the subset can be specified by the names of the machines or the tags on them.  
- **Filter Criteria:** If deploying to a subset of machines provide a comma separated list of the VMs here, else if using tags then provide the tags in the format Role:Web; OS:win7. The default is to deploy to all the VMs in the Resource Group.