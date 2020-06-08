# BashV3 Note

As of August 2019, the BashV3 task has started executing scripts with a target script type of "File Path" instead of sourcing them in the default case.
For backwards compatibility, we will continue to support scripts sourcing.

## Solution

If you know what you're doing and want your script to be sourced, set the ```AZP_BASHV3_OLD_SOURCE_BEHAVIOR``` pipeline variable to true. This is not recommended.
