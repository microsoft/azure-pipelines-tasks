# Preview Tasks and Tools

## Overview

Provide the ability to have preview tasks while still offering stable versions which are patched.  There is also the related desire to make breaking changes in tasks that customers might need to react to during that event.

Tasks typically are just tool runners.  There are two types of tools.  

For some tools, the user needs to be able select/lock the version.  Examples are msbuild/csc for compilation to lock a maintenance branch to.  Another example would be I want to test my node lib against node 4,5 and 6 (select plus matrix option).

For other tools, you typically always just want latest or a single stable version.  Examples of this is git, tfsvc, nuget.

[Related document on tools here](tools.md)

## Caution

Because there is often a desire to lock to a working state, the typical request is I want to lock my task to a specific version.  In some cases this can add more risk and complexity.  The service is constantly moving forward.  Externals are constantly moving forward.  On-prem is by it's nature locked since tasks ship with the product.  

Tasks bundle libs and http clients.  Especially in an emerging preview task, it could use APIs which are in preview and could take breaking changes before they release.  Locking to those could break.  Tasks also drive external tools and service which may deprecate features over long periods of time.

The other challenges are complexity and the testing challenges.  End to end testing and automating every possible locked version against a service which is constantly moving forward is challenging.  Tasks drive large integration scenarios.

Finally, although locked, users should get critical small targetted fixes.  We need the ability to ensure customers get small updates to stable versions (security bug).

## Proposal

Allow user to select major versions of the task in the editor.  Each of these is a channel.  Each channel is either marked as stable or preview.  

When a new major version of the task is available, the definition editor will advise the user that there is a new version.  If that major version is preview, the message will to 'try it out'.  You can always go back.  If it's stable the message should be a little stronger.  If they are more than one major version back, another stronger message.  As noted above, staying back too far also adds risk.

The user selects a major version (2.x) and we display the channel quality.  Even though there may be a 3.0.0-preview, the user does not lock to that.  They lock to 3.x and we advertise it's preview.  Users just get fixes to stable versions and latest on preview.  There is the possibility of subsequent preview versions breaking you (added required field - will fail at runtime).  That's OK.  They are trying out the preview task because they need a new emerging capability.  They will understand.

When a task is added, the default version is latest released or preview if that's all there is.  So a newly added task with a stable and preview available means the immediate experience is advisement that there's also a preview version to try out.  

Newly created tasks always start at 0.x preview.  They should have a few sprints of usage before going to 1.x.

We can't force one stable version because there is another desire to make breaking changes in tasks that require user interaction.  For example, new required fields or deprecating an option.  For that reason, each major version should have an adoption message in the json which is localized and displayed when advertising the new version.  Task authors must create a new major version in significant rewrites and breaking changes.  The editor will ensure the fill in the new appropriate data.  Issue - going back might require them to add inputs that were dropped.

A version of a task will use the [tools api](tools.md) to either lock to a specific version or range (which is downloaded to a tools cache) or in some cases where appropriate, offer the user the ability to select the version.  That should be a combo box so the user can enter versions of external tools that ship after our product does.  Very useful for on-prem.

This also benefits hosted build for tools that can be pulled (packages, zips) where customers have been frustrated by a single locked version that always moves forward.

We have also had sprints where a task-lib change broke multiple tasks which didn't react.  At that time, all our tasks just picked up a single defined lib to use.  We recently added the ability for a task to declare which version of the lib to consume (linked in at build time via npm install or ps-get).  But if you don't, you got the single defined version.  We need to change it to the task must declare.  There is an illusion that if I didn't change the task, it will continue to work.  We need to ensure that is true via libs and tools.

## Engineering

The good news is tasks are semver versioned.  The backend also supports storing and advertising multiple versions.  The distributed task automation also supports taking a version.  Before 1.0 shipped, we had the ability in the UI to select a version but our thinking had not formed so we hid the ability to lock.

We will need to add version selection back but only by major version.  We need to communicate channel quality.  We will need to add advisement that there's a new version along with a description of what that new version offers. 

Our in the box tasks are in one repo which builds on CI and produces a nuget package for VSTS build consumption.  Tasks are then imported into the system during servicing and immutable versions of the tasks are appended to the tasks table and file container storage.

Tasks will have to be able to ship patches to previous major versions (likely just the last) and preview versions.  For that reason, the monolithic repo will have to be split up into a github repo per task.  Each task needs it's own branching since it has to patch previous versions but will need to conform to convention in order to be consumed.  The main tasks repo will still exist as an entry point, an index to the other tasks (issue tracking in each repo - team triages there own issues) and will contain the manifest on the other tasks and versions to publish.  The build will need to be able to build multiple branches/versions of the same task for that sprints package.

The main task repo currently gets branched for each release (e.g. releases/m104).  That will continue to occur but what will branch is the manifest.  The task author needs to update the manifest which branches (convention is version) to build and include in this sprints release.  This needs some detailed design work.  We could consider detecting but explicit is probably better to choose when to ship that preview version.  The fact that it's branch exists should mean it ships.

Custom tasks in the gallery can take advantage of the same versioning strategies by setting the task semver and promotion messaging.  Extensions can carry multiple tasks.  We need to ensure they can carry multiple versions of the same task.  Since users just get updates to extensions, when they go to the definition again, they will see new versions advertised.






