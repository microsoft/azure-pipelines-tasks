This node_modules directory contains a mocked out vsts-task-lib and other libraries for running L0 tests.

Tasks are other code that is run is copied into a temp directory under Tests which is cleared.  Because this node_modules is up the chain, it will ensure the mock is called when the task runs.