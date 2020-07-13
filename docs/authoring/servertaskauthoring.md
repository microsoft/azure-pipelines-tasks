 # Server Task Authoring

In this document, we will talk about how you can author a new server tasks and how it is different from an agent task.

You can take a look at this [document](https://docs.microsoft.com/en-us/vsts/extend/develop/add-build-task) to learn about how you can add a new agent task. Assuming that you are aware of the process for an adding an agent-based task, let us see what all is different in server base task.

#### RunsOn:
This property in task.json specifies where the task should run. The possible values for this property are as follows: -

- Agent
- DeploymentGroup
- Server
- ServerGate

The default value of this property is Agent, but you can change it to Server to specify that the task should run on Azure Pipelines/TFS server. In case you want the task to appear in both server tasks as well as gate tasks, you should specify the value as Server | ServerGate. To learn more about gate tasks, please have a look at this [document](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/docs/authoring/gates.md).

#### Execution section:
This property defines how the task should be executed. For agent-based tasks, you can specify powershell/node handlers to run your custom powershell/node scripts but we don&#39;t support running them on Azure Pipelines/TFS server.

Here are the possible actions you can do for server tasks.

- **HttpRequest** :
This enables you to invoke a Http end-point. It has 3 sections.

    **Execute:** This section specifies what should happen when the task is executed. You can define the endpoint that should be invoked, the http message body that should be sent etc. Here are the complete list of  properties that are supported.
    - EndpointId: - EndpointId that should be used to generate the authentication header. This input is optional.
    - Endpoint URL: - Http Url that should be invoked.
    - Method: - Http verbs like PUT, GET, POST, PATCH, DELETE, OPTIONS, HEAD, TRACE.
    - Body: - Body of http request.
    - Headers: - Headers of http request. Header should be in JSON format.
    - WaitForCompletion: -  Specifies whether Azure Pipelines/TFS server should wait for task completed event from external service. Default value is false which means that Azure Pipelines/TFS server will invoke the URL and once the response received, then it assumes that task is complete. This input is optional.
    - Expression: - Expression criteria which defines when to mark the task as succeeded. No expression means response content does not influence the result. We support all task condition constructs in these expressions and you can read more about them [here](https://go.microsoft.com/fwlink/?linkid=842996).

      Here are some example of the expression: -


         |      Expression        | Response | Result |
         |------------------------|----------|--------|
         | ``` eq(root['status'], 'successful') ``` | ``` {"id": 5, "name": "myObject", "description": "this is my object description", "status": "successful"} ``` | true |
         | ``` ge(count(root['ActiveReleaseNames']), 3) ``` | ``` {"ActiveReleaseNames": [ "Release1", "Release2", "Release3"] } ``` | true |
         | ``` and(eq(count(jsonpath('Items[?(@.price<50)]')), 1), eq(count(jsonpath('Items[?(@.price>60)]')), 2)) ``` | ``` {"Items":[{"name":"item1","price":100},{"name":"item2","price":40},{"name":"item3","price":70}]} ``` | true |

    **Cancel**: This section specifies what should happen when the task is canceled. Here also you can define the endpoint that should be invoked on cancellation, the http message body that should be sent etc. All the properties, except WaitForCompletion and Expression, that we support in execute section are supported. This is an optional section and if you dont specify this section, then Azure Pipelines/TFS will not send you cancellation request but will cancel the task in its layer.

    **Events:** This section is useful when you have a long running task which needs to run asynchronously (waitForCompletion = true). So in that flow, Azure Pipelines/TFS will invoke your endpoint as defined in the above execute section but your endpoint should send status update events to Azure Pipelines/TFS. Your can use the [TaskHttpClient](https://github.com/Microsoft/azure-pipelines-extensions/tree/master/ServerTaskHelper) to send the events as well as logs to Azure Pipelines/TFS server. You can configure timeouts for these events which defines how long Azure Pipelines/TFS should wait for that event to come before timing out the workflow. Max timeout is 72 hours.
    
    Here are all the event types that are supported: -  
    1.  TaskAssigned - Raise this event to acknowledge that the ‘execute’ call has been received (optional).
    2.  TaskStarted - Raise this event when task has started.
    3.  TaskCompleted - Raise this event when task is completed (indicates success/failure). Here is how an example of the event section.

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
This enables you to post a message to azure service bus queue. It has 3 sections.

    **Execute:** This section specifies what should happen when the task is executed. You can define the endpoint on which message should be published, the message body/properties that should be sent etc. Here are the complete list of  properties that are supported.

    - EndpointId: - EndpointId details used while publishing the message.
    - ConnectionString: - Azure service bus connection string.
    - ServiceBusQueueName: - Queue name on which the message should be published.
    - MessageBody: - Message body. It should be JSON format.
    - MessageProperties: - Message properties. It should be JSON format.
    - CertificateString: -  Certificate that can be used to encrypt the message. This input is optional.
    - SignaturePropertyKey: - Key of the service bus message properties in which the signed payload should be kept. Default is signature.

    **Cancel**:  This section specifies what should happen when the task is canceled. Here also you can define the endpoint on which message should be sent on cancellation, the message body/properties that should be sent etc. All the properties that we support in execute section are supported. This is an optional section and if you dont specify this section, then Azure Pipelines/TFS will not send you cancellation request but will cancel the task in its layer.

    **Events:** It  supports the same set of events as specified above in the http task section. 

- **HttpRequestChain**:
This enables you to invoke multiple Http end-points. You can specify a list of invocations in the Execute section. Each invocation in the chain contains following sections.

    **RequestInputs:** This section specifies the inputs to the task execution. You can define the endpoint that should be invoked, the http message body that should be sent etc. Here are the complete list of  properties that are supported.

    - EndpointId: - EndpointId that should be used to generate the authentication header. This input is optional.
    - Endpoint URL: - Http Url that should be invoked.
    - Method: - Http verbs like PUT, GET, POST, PATCH, DELETE, OPTIONS, HEAD, TRACE.
    - Body: - Body of http request.
    - Headers: - Headers of http request. Header should be in JSON format.
    - Expression: - Expression criteria which defines when to mark the invocation as succeeded. No expression means response content does not influence the result. We support all task condition constructs in these expressions and you can read more about them [here](https://go.microsoft.com/fwlink/?linkid=842996).   

    **ExecutionOptions:** You can define output variables that needs to be made available for next execution and expressions to optionally skip the invocation on subsequent execution.
    - OutputVariables: - Define variable name and value as list of key value pairs in JSON format.
      Example:- ```{"locationUrl" : "response['headers']['location']"} here 'locationUrl' is the variable name and 'response['headers']['location']' is the expression for variable value that will be resolved at runtime and made available to subsequent invocation.```
    - SkipSectionExpression: - Expression criteria which defines when to skip the invocation and move to next in the chain. We support all task condition constructs in these expressions and you can read more about them [here](https://go.microsoft.com/fwlink/?linkid=842996).  

Let us understand few concepts/tips & tricks.

  - You can use task inputs, system variables, user defined variables and endpoint variables in 'execute'/'cancel' sections.
    Example: - ``` {...   
              "Body": "$(method)", 
              "Expression": "le(count(root['workItems']), $(maxThreshold))",
              "Headers": "{ \"ProjectId\": \"$(system.TeamProjectId)\" }"
              ...
              },  here 'method' is task input, maxThreshold is user defined variable,  system.TeamProjectId is system variable.```

  - A task which runs on agent less phase can't run on agent phase or deployment group.

  - Async/Sync mode. 
    - You can invoke Http requests in sync mode or  async mode. If http request takes more than 20 secs to complete, then you should use  async mode which means that 'WaitForCompletion' property is set to true.


#### Built-in server tasks making http requests : -
  [InvokeRestApi](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/InvokeRestApiV1/task.json)
  [AzureMonitor](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureMonitorV0/task.json)
  [AzureFunction](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureFunctionV1/task.json)
  [QueryWorkItems](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/QueryWorkItemsV0/task.json)

#### Built-in server tasks publishing serviceBus messages : -

  [PublishToAzureServiceBus](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/PublishToAzureServiceBusV1/task.json)

#### Built-in gates using multiple http invocations : - 
   [AzurePolicy](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzurePolicyV0/task.json)
