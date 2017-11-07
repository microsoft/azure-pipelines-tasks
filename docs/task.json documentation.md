# Task Development Documentation

This documentation provides some details about the VSO build task file task.json and how you can create your own.

Azure information is currently not in this file; please look at the task.json files for those tasks for further details.

This documentation is a work in progress and has been written based on my observations and understanding!

## task.json

The task.json file is what is read by TFS to display the details of the task, including variable input, help and execution details.

The properties of this object define the task, its name, identifier, description, inputs and so on.
For details of the basic properties see example file at the end of this document, the more advanced properties are outlined in detail within the sub-headings below.

### groups
The groups property is an array of 'group' objects. These allow you to define groups which task inputs can be allocated to.

Each group has the following properties:-

| Name |Data Type | Mandatory? | Description |
| :---- | :---- | :---- | :---- |
|name|string|yes|The variable name of the group (no spaces)|
|displayName|string|yes|The text displayed to the user for the group|
|isExpanded|bool|false|Whether this group is expanded by default in the web interface (default is false)|

### inputs
The inputs property is an array of 'input' objects which provide user input to a build task.
The setup of these objects dictates how they will be rendered in the web interface.

Each input has the following properties:-

| Name |Data Type | Mandatory? | Description |
| :---- | :---- | :---- | :---- |
|name|string|yes|The variable name of the input (no spaces)|
|label|string|yes|The text displayed to the user for the input label|
|type|string|yes|The type that dictates the control rendered to the user. There are several options available - see 'input.type' within this guide for more details. |
|defaultValue|string|false|The default value to apply to this input|
|required|bool|false|Whether the input is a required field (default is false)|
|helpMarkDown|string|false|Help to be displayed when hovering over the help icon for the input. To display URLs use the format ```[Text To Display](http://Url)```|
|groupName|string|false|Setting this to the name of a group defined in 'groups' will place the input into that group|
|visibleRule|string|false|Allow's you to define a rule which dictates when the input will be visible to a user, for example ```"variableName = value"```|

#### input.type
Each input can have a type which dictates which control the web interface will render for the user.

| Type | Other Options | Rendered Control | Other Information |
| :---- | :---- | :---- | :---- |
|boolean|N/A|Checkbox||
|connectedService:ServiceType|N/A|Dropdown List with 'Manage' link|Pre-populated with any configured TFS Services, allows free-text entry. Can specify service types e.g. Chef, Azure, Generic to filter|
|filePath|N/A|Single Textbox with file-picker |Allows you to select a path from TFS repository or enter free-text|
|multiLine|N/A|Multi-Line Textbox||
|pickList|Array of 'options' defined as ```"options": { "optionValue": "Display Text" }```. Array of 'properties' (see section below)|Dropdown List with options|The optionValue's can be used as variable references for the input 'visibleRule' property. For example ```"visibleRule": "pickListVariableName = optionValue"```|
|radio|Array of 'options' defined as ```"options": { "optionValue": "Display Text" }```|radio buttons|The optionValue's can be used as variable references for the input 'visibleRule' property. For example ```"visibleRule": "radioButtonVariableName = optionValue"```||
|string|N/A|Single Textbox||

##### input.type.properties
The following input.type values can utilise the 'properties' array and its values: 'pickList'

Example:-
```javascript
{
      "name": "inputName",
      "type": "pickList",
      "label": "My Editable Picklist",
      "defaultValue": "",
	  "properties": {
        "EditableOptions": "True"
      }
}
```

| Name | Description |
| :---- | :---- |
|EditableOptions|If set to True, allows the user to edit options i.e. enter their own When 'False' (the default) only pre-defined options are selectable.|

### Execution
The execution property is an array of 'execution' objects. There are several pre-defined execution types available.

| Execution Type Name | Description |
| :---- | :---- |
|AzurePowerShell|Execute powershell on Azure?|
|Bash|Execute a bash script|
|Node|Executes a Node.js script|
|Powershell|Executes a powershell script|
|Process|Executes an application|

Each execution type can define these properties:-

| Name | Description |
| :---- | :---- |
|target|The target file to be executed. You can use variables here in brackets e.g. $(currentDirectory)\\filename.ps1|
|argumentFormat|string|
|workingDirectory|The directory to execute the task from e.g. $(currentDirectory)|
|platforms|Supported platforms, e.g. ["windows"]|


# Example file structure
(comments provided for reference only and would need to be removed for a valid JSON file)

```javascript
{
    // GUID value goes in id. generator: https://www.guidgenerator.com/online-guid-generator.aspx
   "id": "",
   "name": "NameWithNoSpaces",
   // Descriptive Name, spaces allowed
   "friendlyName": "Descriptive Name",
   // Detailed description of what it does
   "description": "My task is awesome",
   "helpMarkDown": "Help text displayed at the bottom of the Build Task, to use URLs use the format [Text To Display](http://Url)"
   // Category is one of: Build, Utility, Test, Package, Deploy and relates to where it appears in TFS
   "category": "Build",
   "visibility": [
                "Build",
                "Release"
                  ],
   "author": "Joe Bloggs",
   // Always update this when you release your task, so that the agents utilise the latest code
   "version": {
      "Major": 0,
      "Minor": 0,
      "Patch": 1
   },
   // Allows you to define a list of demands that a build agent requires to run this build task
    "demands" : [
        "demandName"
    ],
   "minimumAgentVersion": "1.83.0",
   // Use this to define any groups for the build inputs, these can be expanded or collapsed by default
    "groups":  [
        {
            "name": "NameOfGroup",
            "displayName": "Display Name",
            "isExpanded": true
        }
    ],
   "inputs": [
      {
        // provide a unique name for your variable
         "name": "variablename1",
         // the type for the variable - this dictates the control rendered in TFS Builds (see input.type in this document for details)
         "type": "string",
         // Label to display in Build Web interface (supports spaces)
         "label": "LabelValue",
         "defaultValue": "Hello World",
         "required": true,
         // Help to be displayed when hovering over the help icon for the input
         "helpMarkDown": "Detailed Description",
         // Setting this to the name of a group defined in 'groups' above will place the input into that group
         // absence of this setting will render the input above all other groups
         "groupName": "NameOfGroup"
      },
      {
      // next variable
         "name": "variablename2",
         "type": "string",
         "label": "Label",
         "defaultValue": "",
         "required": false,
         "helpMarkDown": "Detailed Description",
         // If you include this setting, you define conditions to display this input based upon the values of other inputs
         "visibleRule": "variablename1 = test"
      }
      // and so on...
   ],
   // This is how the task will be displayed within the build step list - you can use variable values by using $(variablename)
   "instanceNameFormat": "My Awesome Build Task $(variablename1)",
   // Execution options for this task
   "execution": {
      "PowerShell": {
         "target": "$(currentDirectory)\\TaskName.ps1",
         "argumentFormat": "",
         "workingDirectory": "$(currentDirectory)"
      }
   }
}
```
