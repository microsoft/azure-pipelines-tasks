
You can take a look at this document to learn about how you can add a new [server task](https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/servertaskauthoring.md). Assuming that you are aware of the process for an adding a server task, then to make it a gate, you should do the following. change the runsOn property of your task.

#### Change the RunsOn property :
RunsOn property in task.json specifies where the task should run. The possible values for this property are as follows: -

- Agent
- DeploymentGroup
- Server
- ServerGate

The default value of this property is Agent, but you can change it to ServerGate to specify that the task should run on VSTS/TFS server and should show up in the list of gates in the definition editor. 

#### Provide the result evaulation expression :

In case you are using http request executions in your task, then you should provide the result evaluation expression so that the system can evaluate whether a particular run of a gate has passed or failed. You can learn more about the expression in the server task [documentation](https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/servertaskauthoring.md) and also look for the real usages in our built-in tasks ([Azure monitor task](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureMonitor/task.json), [Query work items](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/QueryWorkItems/task.json).

#### Understand the model difference between gate and server task:



