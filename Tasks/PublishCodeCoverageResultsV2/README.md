# Publish Code Coverage Results

The task negotiates raw coverage support through the project-scoped
`testresults/codecoverage/rawcoveragebundle/capabilities` endpoint. Older
servers, invalid responses, and unavailable endpoints retain
the existing ReportGenerator path. The task resolves the Test Results resource
area through Azure DevOps location services before calling the endpoint. A
server can request additive mode, which
is advertised as `shadow` and uploads a deterministic `Intermediate/coverage/Raw/v1`
bundle before preserving all existing ReportGenerator outputs. Raw-only mode
is used only when the server explicitly advertises `raw-authoritative`. Raw
bundle failures are warnings in additive mode and task failures in raw-only
mode.
PCCR v2 supplies the source pattern indexes for every resolved file. The shared
publisher also accepts legacy string-only callers; those entries use an empty
`sourcePatternIndexes` array because pattern provenance is unavailable at that
layer.

### Overview
The Publish Code Coverage Results task is used to publish the code coverage results of a build. 

### The different parameters of the task are explained below:

- **Summary Files:**		Required Field. The path pattern for summary files containing code coverage statistics, such as line, method, and class coverage. The value may contain minimatch patterns as well as multiline inputs. For example: `$(System.DefaultWorkingDirectory)/MyApp/**/site/cobertura/*.xml`

- **Path to Source Files:**		The file path specifying the location of source files, this is required for generating HTML reports in case of tools which put relative paths in their summary files.

- **Fail when code coverage files are not found:**		Fail the task if the summary file patterns yielded no coverage files.