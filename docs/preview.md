# Preview Tasks and Tools

## Related Docs

[Related document on tools here](tools.md)

## Overview

Provide the ability to have preview tasks while still offering stable versions which are patched.  Adopting a preview version should be a conscious decision based on advisement the task author provides.  

There is also the related desire to make breaking changes in tasks that customers might need to react to during that event.  Adopting a new major version may require entering new inputs.

Adopting a preview or new breaking change major version is done on a case by case basis.  That's per task and per definition.  This is critical since a particular definition might try the new nuget task without forcing every build in the account to use it.

Releasing a new major version should not be taken lightly.  Some common reasons:

  - Introduced a new version that was significantly rewritten (preview)
  - Break input compat and reset the task.  Requires new inputs from the user or removes existing functionality or inputs (deprecating an aspect of the task).
  - Requiring a new major version of the agent (2.x) as the minimum.  

## Caution

Because there is often a desire to lock to a working state, the typical request is I want to lock my task to a specific version.  In some cases this can add more risk and complexity.  The service is constantly moving forward.  Externals are constantly moving forward.  On-prem is by it's nature locked since tasks ship with the product.  

Tasks bundle libs and http clients.  Especially in an emerging preview task, it could use APIs which are in preview and could take breaking changes before they release.  Locking to those could break.  Tasks also drive external tools and service which may deprecate features over long periods of time.

Minor version updates are simply to communicate new capabilities.  Patches are bugs fixes.  Neither can break existing compat and functionality.

Finally, although locked, users should get critical small targetted fixes.  We need the ability to ensure customers get small updates to stable versions (security bug).

## Proposal

Allow user to select major versions of the task in the editor.  Each of these is a channel.  Each channel is either marked as stable or preview.  

When a new major version of the task is available, the definition editor will advise the user that there is a new version.  If that major version is preview, the message will be to 'try it out'.  You can always go back.  If it's stable the message should be a little stronger.  If they are more than one major version back, another stronger message.  As noted above, staying back too far also adds risk.

The user selects a major version (2.x) and we display the channel quality.  Even though there may be a 3.0.0-preview, the user does not lock to that.  They lock to 3.x and we advertise it's preview.  It's about setting expectations. When that task comes out of preview, user's bound to 3.x will not have to change their binding.  They slide along that major channel.

When a task is added, the default version is latest released or preview if that's all there is.  So tasks in new definitions will be locked by default. 

On upgrade, we will update everyone's definition to lock to the current major version. This is what they currently get but will protect them going forward just as new defintions are protected. 

We will optionally support binding to "*" which is latest non-preview.

## Deprecation and Breaking Changes

We can't force one stable version because there is another desire to make breaking changes in tasks that require user interaction.  For example, new required fields or deprecating an option.  For that reason, each major version should have an adoption message in the json which is localized and displayed when advertising the new version.  Task authors must create a new major version in significant rewrites and breaking changes.  The editor will ensure they fill in the new appropriate data.  Going back might require them to add inputs that were dropped.  They will be in history.

## Rollback

The definition view has a history of the definition changes.  We will provide the ability to select a revision in the history view and rollback to it.  It will do that by adding a new version to the history and applying those changes.

## Engineering

For in the box tasks, almost nothing needs to change.  Existing tasks rollout with sprintly releases.  We have the ability run a config change to patch previous versions of tasks.  We need to ensure that along with latest rolling out (which might be preview) we need to be able to patch a previous released version via a config change.  This essentially inserts in the versioning lineage.

For custom extensions, channels are needed.  This is currently being designed.  The requirements and capabilities of build tasks are the same regardless of whether they are in the box or acquired via the market place.  That includes multiple versions of a task installed with the ability to bind per definition, the ability to deprecate and the ability to introduce a breaking change.  The gallery experience is being thought through. 






