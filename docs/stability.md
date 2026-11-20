# Build Platform Quality

## Hosted Build Queue

### Problems

  - My build is stuck in the queue and not getting picked up.
  - Queueing a large number of builds hangs or fails the builds.
  - My hosted build broke after THE image was updated

 ### Investments

  - Machine assignment piepline is more robust
  - More monitoring: orchestration failures, machine request failures, granular queue state
  - More perf counters: throughput and failures
  - More CSS Tool: Expose per SU hosted job queue for visibility.    
  - Parallel jobs for throughput and redundancy to job or agent hanging.
  - MMS is a separate service: Redirect to healthier machine pools (run away from azure re-image issues)
  - Multi-image image support.  Less SxS, Requires MMS sep svc.
  - React Quicker to image issues: Generate the image on a VM in that prod subscription.  Productize intern project already done.  18 hrs --> 1 hr.
  - Run Task L1 tests on the image.  See below in tasks.  Finds real bugs where a tool doesn't actually work (SxS, not in path, etc...) 
  - Break build and/or distributed task (transient execution) out of TFS as big S service or do Named Job Queues
  - JIT tools for user locking of some tools: [Tools feature](tools.md) and Run as Admin you install

## Tasks

### Problems

  - Significant new versions of tasks rollout and broke my build
  - A patch to a task has broken my build
  - A bug in the task lib can take out multiple tasks (happened with Java tasks) 

### Investments

  - Get tasks healthy.  [Current Report here](health.md)
  - Offer major locking of tasks with preview versions.  [Covered here](preview.md)
  - Deploy even patches via Ring model using LR (we currently deploy sprintly task changes via ring model)
  - Test in production builds setup in SU0 breadth of scenario coverage we don't get in mseng (Java, Nuget, iOS, etc...).  Created https://buildcanary.visualstudio.com
  - Compile time and runtime script unit validation via L0 tests [Covered here](https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/stepbystep.md)
  - L1 validation of tests: Runs real tools, no server, no agent.  Note: external contributors can run L0 / L1 for PRs. 
  - Scenario teams (Packaging, Java, etc...) should have L2 tests (E2E).  Build created L2 tests

## Agent

### Problems

  - New versions of the agent broke my build

### Solutions

  - New agents are 2.x.  If you have existing private / on-prem 1.x working, leave it working.
  - Deploy even patches via Ring model using LR (we currently deploy sprintly task changes via ring model)
  - 2.x agent is getting rolled out in hosted pools ~ on SU per sprints.  Currently in SU0, BR1, SU3, SU4.
