# Authoring Task editor extension

## Motivation

Some task inputs can be complex and it might not be the most natural thing for the user to provide the value in the data types currently available to the tasks.
An example would be that your task works with a JSON object with a well-defined schema. You can model the field as *string* or *multiline* in the task today. That works well during execution; however it is not the most intutive experience for the user to provide the input.
In such cases, you can use task editor extension to model the input as a custom UX where user can provide the specific fields of the object. Keep in mind that this is a UX only feature; during execution the task will receive it as a string.

## Authoring the extension

The task editor extension is a [VSTS extension](https://www.visualstudio.com/en-us/docs/integrate/extensions/overview).

The contribution should of type `ms.vss-distributed-task.task-input-editor` and it should target `ms.vss-distributed-task.task-input-editors` contribution.

```
    "contributions":[
        {
            "id": "my-task-editor-extension",
            "type": "ms.vss-distributed-task.task-input-editor",
            "targets": [ "ms.vss-distributed-task.task-input-editors" ],
            "properties": {
                "name": "Editor extension for my custom object",
                "uri": "extension.html"
            }
        }
    ]

```

| Property | Description |
------------------------ |
| name     | Friendly name of the extension | 
| uri      | URI to the page that hosts the html that loads the extension UX and scripts |

** Javascript sample **

The extension can recieve the current value of all the input fields in the task. It also receives a delegate which can be used to query the content of a file in associated Source Control or Release Artifact.
To return the resulting value, the extension needs to register a callback "onOkClicked".
Following sample shows this.

```Typescript

class ITaskEditorExtensionDelegates {
    fileContentProviderDelegate?: (filePath: string, callback: (content: any) => void, errorCallback: (error: any) => void) => void;
}

class configuration {
    target: string; // Name of the input which invoked the extension.
    inputValues: { [key: string]: string; }, // values of all the input fields in the task 
    extensionDelegates: ITaskEditorExtensionDelegates;
}

VSS.ready( function() {

    // Get the config and use it populate your  UX.
    var config: configuration = VSS.getConfiguration();
    
    // Register the onOkyClicked callback.
    VSS.register(VSS.getContribution().id, function () {
            return {
                // Called when the active work item is modified
                onOkClicked: function() {
                    // Return the value to be used as the task input.
                }
            }
    });
});

```





