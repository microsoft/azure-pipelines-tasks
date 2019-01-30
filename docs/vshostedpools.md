# Visual Studio Services VS Hosted Pools

This document is focused on the problems around the common case of building with Visual Studio although it is relevant for other development environments as well.  Mac XCode pools could have the same class of issues.

Small sample of issues:

https://github.com/Microsoft/azure-pipelines-tasks/issues/4361

https://github.com/Microsoft/azure-pipelines-tasks/issues/3787#issuecomment-299835958

https://github.com/Microsoft/azure-pipelines-tasks/issues/4403#issuecomment-304463270

## Hosted Pool Approach

The "Hosted Pool" had a VM image with all versions of VS (2010, 2012, 2013, and 2015) in addition to many other common development tools (Xamarin, Android SDKs, Windows SDKs, etc...).

The Visual Studio Build CI task had a drop down for the VS version you want the task to locate and use.  What it's doing is finding the version of msbuild on the machine which came with the version of VS you selected.

In the model where the VM image had all versions of VS stacked on the machine, it made sense.  Default is hosted pool, everything is there and it's the tasks job to define what to use.

We originally had the task default to "Latest" but in that model of all VS versions present, it cause a problem where a new VS was stacked on the image and everyone's builds broke.  So when VS2015 was released we made the decision for the task default to be latest released (VS2015) and it would stick at definition creation until you changed it (ideally when you converted your projects).

Problems:

  - Stacking all versions of VS is hitting walls.  They all don't fit on the disk, they are taking longer and  longer to copy around (10s of hours to get a simple patch and push images around)
  - Side by Side Issues: Even though SxS is tested, many issues weren't caught and subtle difference in order of install with updates and patches would find bugs leading to instability
  - We couldn't offer preview versions of tools.  Early previews could destabilize the SxS stable versions on that image.

Simply put, one image with all tools was not going to work.

## An Image per Era of VS

Because of the issues above, 2017 introduced a new image with only the VS2017 era of tools.  It was a full install of VS2017 which used close to our full disk quota.

You selected a VS2017 pool of machines by selecting the VS2017 queue.  We will introduce a VS2015 image and deprecate the hosted pool.

That unblocked 2017 usage but we didn't account for alignment problems.  Specifically:

1.  Three moving parts defining VS version: users solution in code, the queue to use, the version to find specified in the task.  They all better align.
2.  The default queue was hosted (VS2015), the task default version was VS2017 and your code was ??.
3.  The queue was hidden in definition options because until now it was a non mainline option - default of hosted pool had everything.


## Solutions

The solutions are in order of implementation and priority.

## Phase One

**Default task to Latest**

In a scheme of image per VS era, Use "Latest" makes sense.  Regardless of the queue you pick it just works.

Once "Latest" is resolved, we can optionally have the task peek into the solution(s) and warn if the target VS version in the solution does not match the (latest) version of VS on the per Era image chosen via the queue.  This also has benefits for private agents with SxS VS versions installed.  This is important since a 2017 solution can fail on VS 2015 on hard to diagnose ways (fails with a cryptic xml schema error).

This just changes the default and doesn't introduce compat issues.

VSBuild, msbuild and vstest tasks will be changed to use latest

**Queue Selection: More obvious and explicit**

Offer pools:

  - Hosted VS2017
  - Hosted VS2015
  - Hosted Deprecated (was Hosted Pool)

On create definition, there will be no default.  You must select the queue as an up front decision.  We can possibly default again if we implement Auto (see below).  Even if we convince ourselves VS2017 is the proper choice, it should still be more up front.  It's not obvious for users to go to the options tab

Queue selection will move to the up front process section of the definition (defauult view after create).  The user will have to choose before saving.

## Phase Two

**Tasks use environment**

New major version of VS/msbuild tasks just use what's in the path.  Create a tools task which sets up the toolset.  Basically it runs dev environment cmd script for that version of VS.

Pick VS environment and everything downstream (including tasks and ad-hoc scripts)

We would expose a process level parameter to pick the version of VS.  *That will contribute to a demand for that version of VS*

**Hosted VS (Auto)**

Introduce a virtual hosted pool.  Based on the demand, we would route to the appropriate Hosted VSxxxx pool.

This also eliminates issues where you have to pick the version in multiple msbuild tasks and separate vs test tasks.  Pick your environment, tasks work.  Essentially models what a dev does.  Pick your VS env from dev cmd prompt or by launching VS then running.

This leverages and follows concepts introduced with tools.  In general, it's a pattern we want to push further.

https://www.youtube.com/watch?v=Ie8EuvqJ0Hg

Once in place, the templates would be updated to include the environment up front to run dev cmd prompt to set up the "tools" or "tool sets".

All tasks, cmd line tasks and scripts downstream will just work and use a consistent VS.

## Future: Hosted (Auto)

If repo analysis is in place we can have a virtual queue which is auto.  Based on the repo analysis post push we can route the build JIT to the proper queue.  This has the benefit of the customer upgrading their VS solutions, pushing the change and the "right thing happens"

## Future: Docker Containers

We are making progress on docker containers with it currently working on Linux and tracking progress on windows.  The agent will run on the host, map in the tasks and then execute with our loosely coupled task model.  This allows you to select any docker image without the need for our agent being on it.

The challenge with VS as docker images is the up front time to pull very large docker images.  This is a bigger problem we need to think about and solve.  There is also scenarios like UI tests where a full VS VM is needed.

We will likely start containers around more focused and targetted scenarios like dotnet core, asp.net and other focused toolsets.





























