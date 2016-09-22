
# Suite Types

Test suites are location in ./Tests folder in the form
```
L#.{area}.ts
```
L0.* is the default suite if you just run gulp test.  Levels are explained below.


## Suite Levels

L0: 
  - Test the task as a unit.  
  - Does not actually call externals (mocked).
  - Does not require a running server/service or agent.
  
L1:
  - Test the task as a unit
  - Actually calls the external - will actually call msbuild, xcode, etc...
  - Does not require a running service/service or agent.
  
L2:
  - E2E.  Requires a running server/service and agent.
  
We will be starting and favor writing and running L0 tests.  After L0s are written, we will flush out some L1 tests.

The point of the tests is to test to task script and it's arcs.  It is a non-goal to test the externals.


