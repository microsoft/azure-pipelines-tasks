# Deprecated Tasks

## Overview

Provides the ability to deprecate a task. 

To mark a task as deprecated - you may need to specify the following property to the task.json definition file:

>"deprecated": true

We consider that a certain task is **deprecated** only when the latest version of that task is marked as deprecated.

When the user searches for deprecated tasks, we push these tasks to the end and group them under a collapsible section that's collapsed by default.

If a definition is already using a deprecated task, we would show a deprecated task badge on the task so that it's clear to the user that the task is deprecated and hence is not currently being maintained, there by encouraging them to make a switch to the replacement.

It is recommended to mention in the task description about the new task that is going to replace the deprecated task.
