 # Agentless Task Authoring

In this document, we will talk about how to author a new agentless tasks and how is it different from an agent-based task.
The [process](https://docs.microsoft.com/en-us/vsts/extend/develop/add-build-task) for authoring and adding an agent-based task.

#### RunsOn:
This property in task.json specifies what type of phase can the task be included in and executed. The possible values for this property are as follows: -
- Agent
- DeploymentGroup
- Server
- ServerGate

The default value of this property is agent indicating execution in an agent phase. Changing it to Server specifies that the task would exeucte in an agentless phase. Specifying the value as Server | ServerGate ensures the task can be executed in an agentless phase and as a release gate. [This](https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/gates.md) talks more about authoring gate tasks.
Agent-less tasks can not executed in agent or deployment group phases.

#### Execution section:
This property defines how the task should be executed. For agent-based tasks, you specify powershell/node handlers and point to  powershell/node scripts that need to be executed. For agent-less tasks, there is a pre-defined set of execution handlers to choose from. Execution of custom scripts is not supported in agentless tasks.

The following actions are supported for agent-less tasks.

- **HttpRequest** :
This enables invokation of a Http end-point as a part of the task. It is important to note that an agentless task can only invoke one and only one Http end-point.
This section has 3 sub-sections.

    **Execute:** This sub-section specifies what should happen when the task is executed. The endpoint that should be invoked is defined, along with the http message body to be sent etc. Here is the complete list of  properties that are supported.
    - EndpointId: - EndpointId that should be used to generate the authentication header. This input is optional.
    - Endpoint URL: - Http Url that should be invoked.
    - Method: - Http verbs like PUT, GET, POST, PATCH, DELETE, OPTIONS, HEAD, TRACE.
    - Body: - Body of http request.
    - Headers: - Headers of http request. Header should be in JSON format.
    - WaitForCompletion: -  Specifies that the task would remain in progress (i.e. VSTS/TFS would wait) till a task completed event is received from the external service. This is particularly useful when invokation of the Url triggers a background job in the external service and the task needs to wait for the background job to complete. Default value is false which means that the task shall complete once a response is received from  invokation of the URL. This input is optional. It is mandatory to have WaitForCompletion as true if the Url execution takes more than 20 seconds.
    - Expression: - Defines the condition based on which the task is marked as succeeded. Expressions are based on the response body received from invokation of the URL. No expression means response content does not influence the result. All [task condition constructs](https://go.microsoft.com/fwlink/?linkid=842996) are supported in the expressions.   
    
      Following are some example expressions.
      
      
         |      Expression        | Response | Result | 
         |------------------------|----------|--------|
         | ``` eq(root['status'], 'successful') ``` | ``` {"id": 5, "name": "myObject", "description": "this is my object description", "status": "successful"} ``` | true |
         | ``` ge(count(root['ActiveReleaseNames']), 3) ``` | ``` {"ActiveReleaseNames": [ "Release1", "Release2", "Release3"] } ``` | true |
         | ``` and(eq(count(jsonpath('Items[?(@.price<50)]')), 1), eq(count(jsonpath('Items[?(@.price>60)]')), 2)) ``` | ``` {"Items":[{"name":"item1","price":100},{"name":"item2","price":40},{"name":"item3","price":70}]} ``` | true |      
      
    **Cancel**: This sub-section specifies what should happen when the task is canceled. Another endpoint that should be invoked on cancellation, along with the http message body etc. is defined. All the properties, except WaitForCompletion and Expression, that are  supported in execute sub-section are supported for cancellation. This is an optional section. If this section is not specified, then no  cancelation request is sent and the task is immediately terminated. 

    **Events:** This sub-section is useful when the task waits for a long runnning operation (background job) in the external service (i.e. waitForCompletion = true in execute sub-section). As intermediate status updates of the operation, the external service can send a set of events. [TaskHttpClient](https://github.com/Microsoft/vsts-rm-extensions/tree/master/ServerTaskHelper) describes how to send the events and logs from the external service to VSTS/TFS. This section defines the events that the task honors and timeouts (i.e. duration that task would wait for the specific event to come before terminating the workflow). Max timeout for each event is 72 hours.
    
    Here are all the event types that are supported: -  
    1.  TaskAssigned - This event acknowledges that the ‘execute’ call has been received (optional).
    2.  TaskStarted - This event indicates that the task has started.
    3.  TaskCompleted - This event signals completion of the task (indicates success/failure). 
    
    An example of the event section is as follows. 
         ```Events: 
            { 
               "TaskStarted": 
               {
                  "Timeout": "00:05:00"
               }, 
               "TaskCompleted": 
               {
                  "Timeout": "00:07:00"
               }
            }
       
- **ServiceBus**:
This enables a message to be posted on Azure Service Bus Queue as a part of the task. 
It has 3 sub-sections.

    **Execute:** This sub-section specifies what should happen when the task is executed. The endpoint to which the message should be published and the message body/properties that should be sent are defined here. Here are the complete list of properties that are supported. 
    
    - EndpointId: - EndpointId to which the message should be published.
    - ConnectionString: - Azure service bus connection string.
    - ServiceBusQueueName: - Queue name on which the message should be published.
    - MessageBody: - Message body in JSON format.
    - MessageProperties: - Message properties in JSON format.
    - CertificateString: -  The message can optionally be signed using the certificate provided here. This input is optional.
    - SignaturePropertyKey: - Key of the service bus message properties in which the signed payload is passed. Default is signature.
    
    **Cancel**: This sub-section specifies what should happen when the task is canceled. Another endpoint on which the cancellation message should be sent and the message body/properties that should be sent are defined here. All the properties that supported in execute sub-section are supported. This is an optional section. If this section is not specified, then no  cancelation message is sent and the task is immediately terminated.

    **Events:** It  supports the same set of events as specified above in the http task section. 


#### Notes section:

Use of task inputs, system variables, user defined variables and endpoint variables is permitted in 'execute'/'cancel' sections.
   For example: - ``` {...   
            "Body": "$(method)", 
            "Expression": "le(count(root['workItems']), $(maxThreshold))",
            "Headers": "{ \"ProjectId\": \"$(system.TeamProjectId)\" }"
            ...
             },  here 'method' is task input, maxThreshold is user defined variable,  system.TeamProjectId is system variable.```

#### Built-in server tasks making http requests : -
  [InvokeRestApi](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/InvokeRestApi/task.json)  
  [QueryAzureMonitorAlerts](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureMonitor/task.json)  
  [InvokeAzureFunction](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureFunction/task.json)   
  [QueryWorkItems](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/QueryWorkItems/task.json)   

#### Built-in server tasks publishing serviceBus messages : -

  [PublishToAzureServiceBus](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/PublishToAzureServiceBus/task.json)
