# Authoring Task editor extension

## Motivation

Some task inputs can be complex and it might not be the most natural thing for the user to provide the value in the data types currently available to the tasks.
An example would be that your task works with a JSON object with a well-defined schema. You can model the field as *string* or *multiline* in the task today. That works well during execution; however it is not the most intutive experience for the user to provide the input.
In such cases, you can use task editor extension to model the input as a custom UX where user can provide the specific fields of the object. Keep in mind that this is a UX only feature; during execution the task will receive it as a string.

## Authoring the UX 

The task editor extension is a [VSTS extension](https://www.visualstudio.com/en-us/docs/integrate/extensions/overview).




