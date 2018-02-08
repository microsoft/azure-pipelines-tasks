# Server Task Authoring

In this document, we will talk about how you can author a new server tasks and how it is different from an agent task.

You can take a look at this [document](https://docs.microsoft.com/en-us/vsts/extend/develop/add-build-task) to learn about how you can add a new agent task. Assuming that you are aware of the process for an adding an agent-based task, let us see what all is different in server base task.

#### RunsOn:
This property in task.json specifies where the task should run. The possible values for this property are as follows: -

- Agent
- DeploymentGroup
- Server
- ServerGate

The default value of this property is Agent, but you can change it to Server to specify that the task should run on VSTS/TFS server.

#### Execution section:
This property defines how the task should be executed. For agent-based tasks, you can specify use powershell/node handlers to run your custom powershell/node scripts but we don&#39;t support running them on VSTS/TFS server.

Here are the possible actions you can do for server tasks.

- **HttpRequest** :
This enables you to invoke a Http end-point. It takes 3 inputs.

    **Execute:** Configures the HTTP payload and properties for the Execute event raised from VSTS to the cloud service.  'HttpRequest' handler supports following properties.
    - EndpointId: - Specifies the endpointId which should be used to generate the authentication header. This input is optional.
    - Endpoint URL: - Http Url to trigger on task execution.
    - Method: - Http method like PUT, GET, POST, PATCH, DELETE, OPTIONS, HEAD, TRACE.
    - Body: - Body of http request.
    - Headers: - Headers of http request. Header should be in JSON format.
    - WaitForCompletion: -  You can specify true or false. Default value false. If you specify &#39;true&#39;, server waits for TaskCompleted event happen from external. If task event not comes within task timeout, task will be canceled. This input is optional.
    - Expression: - Expression Criteria which defines when to pass the task. No expression means response content does not influence the result. Example: - For response {&quot;status&quot;: &quot;successful&quot;}, the expression can be eq(root[&#39;status&#39;], &#39;successful&#39;). [More Information](https://go.microsoft.com/fwlink/?linkid=842996).
    
    **Events:** This property gives control on task execution. &#39;Events&#39; property is optional. External systems respond with these events to indicate state changes using the [TaskHttpClient](https://github.com/Microsoft/vsts-rm-extensions/tree/master/ServerTaskHelper) to post the events and task execution logs to VSTS/TFS server. You can configure timeouts for these events. The possible values for this property are as follows: -
    1.  TaskAssigned - External service raises to acknowledge that the ‘Execute’ event has been received (optional).
    2.  TaskStarted - Raised when the external service starts processing.
    3.  TaskCompleted -Raised when the external system is done processing (indicates success/failure).
    
         *Example*: "Events": { "TaskStarted": {"Timeout": "00:05:00"}, "TaskCompleted": {"Timeout": "00:07:00"}}, In this example once server picks task for execution, if server does not receive the &#39;TaskStarted&#39; event within 5 minutes, server cancels the task. If server not receives the &#39;TaskCompleted&#39; event within 7 minutes, server cancels the task.

    **Cancel**: Configures the HTTP payload and properties for the Cancel event raised from VSTS to the external service. This property is optional.  You can configure these properties if you want call to external service on user canceling the task. Properties are same as 'Execute' properties defined above.

- **ServiceBus**
This enables you to post a message to azure service bus queue. It takes 3 inputs.

    **Execute:** Configures the servicebus message payload and properties for the Execute event raised from VSTS to the cloud service. ServiceBus handler has following properties.
    - EndpointId: - EndpointId details used while publishing the message.
    - ConnectionString: - Azure service bus connection string.
    - ServiceBusQueueName: - Queue name to publish message.
    - MessageBody: - Message body. Message body should be JSON format.
    - MessageProperties: - Message properties. like Content-Type:"application/json".
    - CertificateString: -  Certificate that can be used to encrypt the message. This input is optional.
    - SignaturePropertyKey: - Specifies the key of the service bus message properties in which the signed payload should be kept. Default is signature.
    
    **Events:** Same set of events mentioned above are supported in ServerBus also.  
  
    **Cancel**:  configures the servicebus message payload and properties for the Cancel event raised from VSTS to the cloud service. This property is optional. Properties are same as 'Execute' properties defined above.

Task inputs, all well know system variables, user defined variables and endpoint variables can be used in 'execute' properties. Example '"Body": "$method"', here 'method' is task input.
     
Let us understand few concepts/tips &amp; tricks.

- A task which runs on agent less phase can&#39;t run on agent phase or deployment group.
- Async/Sync mode.
  - You can invoke Http request sync mode and async mode. If http request takes more than 20 secs to complete, you should execute in async mode. &#39;WaitForCompletion&#39; in &#39;Execute&#39; property defines this. You can set &#39;WaitForCompletion&#39; true to execute http request in async mode. In async mode VSTS/TFS server wait for taskcompleted event from external service.
- Expression evaluation.
  - You can specify an expression based on the http response to define when to pass the task. You can set &#39;Expression&#39; property to define task result. No expression means response content does not influence the result.
     *Example*: - For response {"status”: "successful"}, the expression can be eq(root['status'], 'successful'). In this example task succeeds only 'status' value 'successful'.  For response {“ActiveReleases”: [ “Release1”, “Release2”, “Release3”] }, the expression can be  ge(count(root[‘ActiveReleasesName’]), 3), here task succeeds only if ‘ActiveReleases’ array count greater than or equal to 3. [More Information](https://go.microsoft.com/fwlink/?linkid=842996).

##### HttpReques handler task references: -
  [InvokeRestApi](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/InvokeRestApi/task.json)  
  [AzureMonitor](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureMonitor/task.json)   
  [AzureFunction](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureFunction/task.json)   
  [QueryWorkItems](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/QueryWorkItems/task.json)   

##### ServiceBushandler task references:-
  [PublishToAzureServiceBus](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/PublishToAzureServiceBus/task.json)
