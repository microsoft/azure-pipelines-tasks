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
This property defines how the task should be executed. For agent-based tasks, you can specify powershell/node handlers to run your custom powershell/node scripts but we don&#39;t support running them on VSTS/TFS server.

Here are the possible actions you can do for server tasks.

- **HttpRequest** :
This enables you to invoke a Http end-point. It has 3 sections.

    **Execute:** This section specifies what should happen when the task is executed. You can define the endpoint that should be invoked, the http message body that should be sent etc. Here are the complete list of  properties that are supported.
    - EndpointId: - EndpointId that should be used to generate the authentication header. This input is optional.
    - Endpoint URL: - Http Url that should be invoked.
    - Method: - Http verbs like PUT, GET, POST, PATCH, DELETE, OPTIONS, HEAD, TRACE.
    - Body: - Body of http request.
    - Headers: - Headers of http request. Header should be in JSON format.
    - WaitForCompletion: -  Specifies whether VSTS/TFS server should wait for task completed event from external service. Default value is false which means that we will invoke the URL and once we have received the response, then we assume that task is complete. This input is optional.
    - Expression: - Expression criteria which defines when to mark the task as succeeded. No expression means response content does not influence the result. 
    
    Here are some example of the expression: -

|      Expression        | Response | Result | 
|------------------|------|------|
| ```eq(root['status'], 'successful')``` | ```{
                                                "id": 5
                                                "name": 'myObject'
                                                "description": 'this is my object description'
                                                "status": 'successful'
                                              } ```| true |
    
      - You can specify an expression based on the http response to define when to pass the task. You can set &#39;Expression&#39; property to define task result. No expression means response content does not influence the result.
     *Example*: - For response {"status”: "successful"}, the expression can be eq(root['status'], 'successful'). In this example task succeeds only 'status' value 'successful'.  For response {“ActiveReleases”: [ “Release1”, “Release2”, “Release3”] }, the expression can be  ge(count(root[‘ActiveReleasesName’]), 3), here task succeeds only if ‘ActiveReleases’ array count greater than or equal to 3. [More Information](https://go.microsoft.com/fwlink/?linkid=842996).


 We support all task condition constructs in these expressions and you can read more about them [here] (https://go.microsoft.com/fwlink/?linkid=842996).
    
    **Cancel**: This section specifies what should happen when the task is canceled. Here also you can define the endpoint that should be invoked on cancelation, the http message body that should be sent etc. All the properties, except WaitForCompletion and Expression, that we support in execute section are supported. This is an optional section and if you dont specify this section, then VSTS/TFS will not send you cancelation request but will cancel the task in its layer. 

    **Events:** This section is useful when you have a long running task which needs to run asynchronously (waitForCompletion = true). So in that flow, VSTS/TFS will invoke your endpoint as defined in the above execute section but your endpoint should send status update events to VSTS/TFS. Your can use the [TaskHttpClient](https://github.com/Microsoft/vsts-rm-extensions/tree/master/ServerTaskHelper) to send the events as well as logs to VSTS/TFS server. You can configure timeouts for these events which defines how long VSTS/TFS should wait for that event to come before timing out the workflow. Max timeout is 72 hours. 
  
  Here are all the event types that are supported: -
  
    1.  TaskAssigned - Raise this event to acknowledge that the ‘execute’ call has been received (optional).
    2.  TaskStarted - Raise this event when task has started.
    3.  TaskCompleted - Raise this event when task is completed (indicates success/failure).
 
 Here is how an example of the event section. 
 
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
             }```
             


- **ServiceBus**
This enables you to post a message to azure service bus queue. It has 3 sections.

    **Execute:** This section specifies what should happen when the task is executed. You can define the endpoint on which message should be published, the message body/properties that should be sent etc. Here are the complete list of  properties that are supported. 
    
    - EndpointId: - EndpointId details used while publishing the message.
    - ConnectionString: - Azure service bus connection string.
    - ServiceBusQueueName: - Queue name on which the message should be published.
    - MessageBody: - Message body. It should be JSON format.
    - MessageProperties: - Message properties. It should be JSON format.
    - CertificateString: -  Certificate that can be used to encrypt the message. This input is optional.
    - SignaturePropertyKey: - Key of the service bus message properties in which the signed payload should be kept. Default is signature.
    
    **Cancel**:  This section specifies what should happen when the task is canceled. Here also you can define the endpoint on which message should be sent on cancelation, the message body/properties that should be sent etc. All the properties that we support in execute section are supported. This is an optional section and if you dont specify this section, then VSTS/TFS will not send you cancelation request but will cancel the task in its layer.

**Events:** It  supports the same set of events as specified above [LINK] in the http task section. 
  
Let us understand few concepts/tips &amp; tricks.

- You can use task inputs, system variables, user defined variables and endpoint variables in 'execute'/'cancel' sections.

Example

SPECIFY A COMPLEX EXAMPLE 

'"Body": "$method"', here 'method' is task input.

- A task which runs on agent less phase can&#39;t run on agent phase or deployment group.

- Async/Sync mode.
  - You can invoke Http requests in sync mode or  async mode. If http request takes more than 20 secs to complete, then you should use  async mode which means that 'WaitForCompletion' property is set to true.
  

##### Built-in server tasks making http requests : -
  [InvokeRestApi](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/InvokeRestApi/task.json)  
  [AzureMonitor](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureMonitor/task.json)   
  [AzureFunction](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/AzureFunction/task.json)   
  [QueryWorkItems](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/QueryWorkItems/task.json)   

##### Built-in server tasks publishing serviceBus messages : -

  [PublishToAzureServiceBus](https://github.com/Microsoft/vsts-tasks/blob/master/Tasks/PublishToAzureServiceBus/task.json)
