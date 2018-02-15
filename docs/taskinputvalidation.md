Task input validation
=====================

Goals
-------

1. Task authors should be able to do wellknown and custom validations with ease.
    - Eg: A valid - URL, IP Address, e-email address, Date, Port number, Cert thumbprint, user name (IDN or UPN format), input based (length of input, valid `path` characters, case checkings)
    - Let task authors provide any custom regex validations
    - Note: To prevent [reDoS](https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS) we should give a [timeout](https://msdn.microsoft.com/en-us/library/hh160196%28v=vs.110%29.aspx) to regex validation.
2. *Non goal/Goal to get holistic view* - Provide task input enforcement and also ability to advise possible input values
    - Eg: If a task input called `destination` is `abc` then the possible list of values for a task input called `target` should be
    *one of* `[x,y,z]`. This imples that the value of the input `target` should be enforced to be one of them *and* also the UI should advise those inputs as possible values to the user.
3. *Non goal/Unclear goal* - Authors should be able to run custom javascript
    - Task authors can point to a javascript file and render the whole task editor in iframe?
    - Task authors can point to custom javascript to control just task input's visibility and validation?

-------

Supported functions
-------

> `value` is alias to task input value

- `isUrl(value: string)` - true if value is of valid URL, allows ftp urls as well
- `isIpV4Address(value: string)` - true if value is a valid IPV4 address
- `isEmail(value: string)` - true if value is of email format
- `isInRange(value: number, min: number, max: number)` - true if value is <= max and >= min
- `isSha1(value: string)` - true if value is a valid sha1 hash, git short-hand sha1 is not considered valid
- ~~`isWindowsUsername(value: string)`~~ - true if value is of samAccountName or userPrincipalName format
- ~~`isLowerCase(value: string)`~~ - true if value is all lower case
- ~~`isUpperCase(value: string)`~~ - true if value is all upper case
- `length(value: any)` - returns the length of the object, supported objects are arrays, strings, collections, dictionaries
- ~~`isWindowsPath(value: string)`~~- true if value has valid Windows NTFS path characters
- `isMatch(value: string, regEx: string, regExOptions: string)` - true if value matches the regex
    - Since validation could be performed on C# and javascript, this is how we can achieve that:
        - We would be using `ECMAScript` for C# [regex options](https://msdn.microsoft.com/en-us/library/system.text.regularexpressions.regexoptions(v=vs.110).aspx)
        - We also by set `CultureInvariant` by default
        - When we use `ECMAScript`, we can only specify `IgnoreCase` and/or `Multiline` options to C# regex
        - With such limitations, javascript equivalent flags we support would be `g` (for global match, this gets translated to getting a [single match](https://msdn.microsoft.com/en-us/library/system.text.regularexpressions.regex.match(v=vs.110).aspx) or [all matches](https://msdn.microsoft.com/en-us/library/system.text.regularexpressions.regex.matches.aspx) in C#), `i` (for C# `IgnoreCase`), `m` (for C# `Multiline`)
        - Default C# behavior would be to use single match
        - So, we would be supporting these options:
            - IgnoreCase
            - Multiline
        - Multiple options can be delimited by comma
        - Valid options - "IgnoreCase, Multiline", "Multiline", "Multiline, IgnoreCase", "IgnoreCase"

-------
Usage
-------


```
    inputs: [
                {
                    "name": "input1",
                    ...
                    "validation": { //new
                        "expression": "VALIDATION_EXPRESSION_HERE",
                        "message": "SOME_KEY_FROM_TASKJSON"
                    }
                }
        ]
```
Validation expressions follow the familiar expression syntax used for [task conditions](https://www.visualstudio.com/en-us/docs/build/concepts/process/conditions) and could use any of the above mentioned supported functions besides the general functions supported by task conditions.

>Note: `Variables` alias in task conditions is not available for input expressions. Only `value` is valid, which references to the task input value.

Expression examples to meet goals - 1,2

- **(goal 1):**

```
      VALIDATION_EXPRESSION_HERE = "expression_using_any_functions"
      -------------------------------------------------------------------------------------
      VALIDATION_EXPRESSION_HERE = "and(isWinUsername(value), isLowerCase(value))"
```      

- **(goal 2):** (**Not implemented yet**)

```
    inputs: [
                {
                    "name": "input2",
                    "type": "picklist"
                    "properties": {
                        "EditableOptions": "true"
                    },
                    "options": {
                        "value1": "display value 1",
                        "value2": "display value 2",
                    }
                    "conditionalOptions": [ //new
                        {
                            "when": "WHEN_EXPRESSION_HERE",
                            "editable": "false", // overrides EditableOptions from properties
                            "options": { // implicit validation, value should be one of these
                                "foo1": "foo display value 1",
                                "foo2": "foo display value 2",
                            }
                        },
                        {
                            "when": "WHEN_EXPRESSION_HERE",
                            "editable": "true",
                            "options": {
                                "bar1": "bar display value 1",
                                "bar2": "bar display value 2",
                            },
                            "validation": {
                                "expression": "VALIDATION_EXPRESSION_HERE",
                                "message": "SOME_KEY_FROM_TASKJSON"
                              }
                        }
            ]
```
        WHEN_EXPRESSION_HERE = eq(inputs.input1, 'foo') // has access to other input values
        -------------------------------------------------------------------------------------
        VALIDATION_EXPRESSION_HERE = "isEmpty(value)"


-------

Limitations/Challenges
-------

- Validation have to be performed in all phases:
    - Design time
        - Includes - editor validation (**works for both release and build definitions**), when definition is being saved (**works only for build definitions, release definitions would get this soon**)
        - We would have to ignore macro expansions in values
    - Queue time (**works only for build definitions, release definitions would get this soon**)
        - We can expand variables available for us at queue time and validate
    - Run time (**Not implemented yet**)
        - Agent would have to perform final validation when it actually has the value with all of the macros expanded
- WHEN_EXPRESSION allows to reference other inputs, is there a need for VALIDATION_EXPRESSION to access other input values too? Both should be driven by similar expression support regardless, but could there be scenarios where validation needs to access other input values? Is that something Goal **3** would eventually solve?
