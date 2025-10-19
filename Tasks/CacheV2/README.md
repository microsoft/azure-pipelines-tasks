# Cache Task

This task improves build performance by caching files between pipeline runs.

## Description
The Cache task can save time by caching files from one run to another. The task helps you deliver faster builds by restoring previously cached files, so you don't have to regenerate or redownload them.

## Common usage scenarios

- **Package dependencies**: Cache your package manager's cache directory to avoid downloading package dependencies for every build.
- **Build outputs**: Cache compiled or processed files that don't change often to speed up builds.

## Example: Caching Yarn packages

```yaml
variables:
  YARN_CACHE_FOLDER: $(Pipeline.Workspace)/.yarn

steps:
- task: Cache@2
  inputs:
    key: 'yarn | "$(Agent.OS)" | yarn.lock'
    restoreKeys: |
       yarn | "$(Agent.OS)"
    path: $(YARN_CACHE_FOLDER)
  displayName: Cache Yarn packages
```

## Notes
- The cache directory (specified in the `path` input) will be created automatically if it doesn't exist
- For Yarn, make sure to set the `YARN_CACHE_FOLDER` variable to point to the cache location
- For other package managers, set the appropriate environment variables according to the package manager's documentation

## Inputs

| Input | Description |
| ----- | ----------- |
| key | Key (unique identifier) for the cache. This should be a string that can be segmented using '|'. File paths can be absolute or relative to $(System.DefaultWorkingDirectory). |
| path | Path of the folder to cache. Can be fully-qualified or relative to $(System.DefaultWorkingDirectory). Wildcards are not supported. |
| cacheHitVar | Variable to set to 'true' when the cache is restored (i.e. a cache hit), otherwise set to 'false'. |
| restoreKeys | Additional restore key prefixes that are used if the primary key misses. This can be a newline-delimited list of key prefixes. |