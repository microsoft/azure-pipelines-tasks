# Visual Studio Services VS Hosted Pools  

This document is focused on the problems around the common case of building with Visual Studio although it is relevant for other development environments as well.  Mac XCode pools could have the same class of issues.

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

## Part One: Default task to Latest

In a scheme of image per VS era, Use "Latest" makes sense.  Regardless of the queue you pick it just works.

Once "Latest" is resolved, we can optionally have the task peek into the solution(s) and warn if the target VS version in the solution does not match the (latest) version of VS on the per Era image chosen via the queue.  This also has benefits for private agents with SxS VS versions installed.  This is important since a 2017 solution can fail on VS 2015 on hard to diagnose ways (fails with a cryptic xml schema error).

This just changes the default and doesn't introduce compat issues.

## Part Two: Explicit Pool Selection

Offer pools:

  - Hosted VS2017
  - Hosted VS2015
  - Hosted Deprecated (was Hosted Pool)

On create definition, there is not default.  You must select the queue as an up front decision.  We can possibly default again if we implement Auto (see below).

## Part Three: Tasks use environment

New major version of VS/msbuild tasks just use what's in the path.  Create a tools task which sets up the toolset.  Basically it runs dev environment cmd script for that version of VS.

Pick VS environment and everything downstream (including tasks and ad-hoc scripts)

This also eliminates issues where you have to pick the version in multiple msbuild tasks and separate vs test tasks.  Pick your environment, tasks work.  Essentially models

## Part Four: Hosted (Auto)

If repo analysis is in place we can have a virtual queue which is auto.  Based on the repo analysis post push we can route the build JIT to the proper queue.  This has the benefit of the customer upgrading their VS solutions, pushing the change and the "right thing happens"





























