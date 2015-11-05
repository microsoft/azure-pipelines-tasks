
# Running Tests

After running gulp to build, run gulp test to run the L0 task test suites.

```bash
$ gulp test
[15:02:47] Using gulpfile ~/Projects/vso-agent-tasks/gulpfile.js
[15:02:47] Starting 'compileTests'...
[15:02:48] Compiling TypeScript files using tsc version 1.6.2
[15:02:49] Finished 'compileTests' after 2.08 s
[15:02:49] Starting 'test'...

...


  Gulp Suite
Running: gulptask.js
    ✓ runs a gulpfile with cwd

  Xcode Suite
Running: xcodebuild2.js
    ✓ Xcode runs a workspace


...
```

# Suite Types

Test suites are location in ./Tests folder in the form
```
L#.{area}.ts
```
L0.* is the default suite if you just run gulp test.  Levels are explained below.

## Examples:

Run the L0 tests (default)
```bash
gulp test
```

or

```bash
gulp test --suite L0/*
```

Run the L0 gulp tests
```bash
gulp test --suite L0/Gulp
```

Run all gulp tests
```bash
gulp test --suite '*/Gulp'
```

Run all tests
```bash
gulp test --suite '**'
```

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

 