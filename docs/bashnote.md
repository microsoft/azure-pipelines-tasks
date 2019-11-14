# BashV3 Note

As of August 2019, the BashV3 task has started executing scripts with a target script type of "File Path" instead of sourcing them in the default case.
This does not work for scripts that do not have the executable bit set.
For backwards compatibility, we will continue to source scripts that don't have the executable bit set. This will throw a warning.

## Solution

For most users, the correct response should be to make sure the executable bit is set on their script.

```
chmod +x <filename>
```

If you know what you're doing and want your script to be sourced without a warning, set the ```AZP_BASHV3_OLD_SOURCE_BEHAVIOR``` pipeline variable to true. This is not recommended.
