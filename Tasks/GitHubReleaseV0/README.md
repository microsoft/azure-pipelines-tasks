# GitHub Release

## Overview

The [GitHub Release task](https://aka.ms/AA3m1bq) can be used to create/edit/delete a GitHub release directly from your CI/CD pipeline. This task works on cross platform Azure Pipeline agents running Windows, Linux or Mac and uses GitHub APIs to manage GitHub releases.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work. You can also share feedback about the task, like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites are required for the task to work properly:

#### GitHub Service Connection

In order to perform operations on the GitHub repository, the task needs a GitHub service connection with adequate permission. If it does not exist already, you can [create a GitHub service connection](https://aka.ms/AA3am5s) in your azure pipelines project. Once the service connection is created, all you need is the name of the service connection in this task.

## Parameters of the task

The GitHub Release task can run in 3 action types, viz. create, edit or delete. Based on the action chosen by the user certain parameters will be ignored. The following is the list of parameters required for this task.

* **Service Connection:** This is the name of GitHub service connection which will be used to connect to target GitHub account. You can use an existing GitHub service connection or create a new one. Note that the service connection should use OAuth or PAT for authentication.

* **GitHub Repository:** This is the name of the GitHub repository where GitHub releases will be managed. E.g. `microsoft/vscode`.

* **Action:** Action is the type of release operation you want perform using this task. This task can perform 3 different actions - create, edit or delete.

    * Create: This action creates a GitHub release. Throws error if a published release already exists with the given tag.

    * Edit: This action modifies a existing GitHub release. Tag is used to identify the release to be edited. Throws error if more than 1 release(draft or published) is found with the given tag.

    * Delete: This action deletes a GitHub release. Tag is used to identify the release to be deleted. Throws error if more than 1 release(draft or published) is found with the given tag.

* **Target:** This is the commit SHA for which the GitHub release will be created. By default, the value is $(Build.SourceVersion) which corresponds to the commit for which the build was run. If you specify a branch name here(E.g. *master* ), the latest commit from this branch will be used as target. This field is ignored when using edit and delete actions.

* **Tag Source:** This parameter allows you to choose the source of tag to be used for a release action. This is available only for *create* action. It can be done in 2 ways:

    * Git tag: Choose this option if the tag to be used in release creation has been pushed to the repository. The release will be created using the git tag that is associated with this commit. If no tag is found for the given commit, the release will not be created. If multiple tags are found, the task will throw an error.

    * User specified tag: Choose this option if you want the task to create a new tag. The release will subsequently be created using the new tag provided in the 'tag' parameter. If the tag already exists in the repository, then the release will be created for the existing tag. 
    
* **Tag:** This is the tag to be used for the chosen release action. You can specify the tag directly or by using variables, Eg. v\$(MajorVersion).\$(MinorVersion).\$(PatchVersion). For *edit*, *delete* actions, the release having this tag will be acted upon. For *create* action, a new release will be created with this tag. Note that this is a mandatory field for *edit* and *delete* actions. 

* **Release Title:** This is the title that will be used for release creation. If left empty, the tag name will be used as the release title.

* **Release Notes Source:** This field lets you specify the source for the description of your GitHub release. There are 2 ways for doing this:
    * Release notes file: On selecting this, you will have to specify the path to the file. The contents of this file will be copied as release notes at the time of release creation.
    * Inline release notes: On selecting this, you can manually type your release notes into a text area. The contents of this text area will be copied as release notes at the time of release creation.

* **Assets** These are the files that will be uploaded as assets for the release. You can use wild card characters to specify a set of files. All the matching files shall be uploaded. You can also specify multiple patterns - one path per line. By default, it uploads the contents of $(Build.ArtifactStagingDirectory). If the specified folder is missing, it throws a warning.

* **Asset Upload Mode** This option is used in case of editing a release. There are 2 ways in which assets can be uploaded.

    * Delete existing assets: When using this option, the task will first delete any existing assets in the release and upload all the assets once again.

    * Replace existing assets: When using this option, the task will replace any assets that have the same name*

* **Draft Release**  Check this option if the release has to be saved as a draft release. If kept unchecked, the created release will be published.  This option is ignored in case of *delete* action.

* **Pre Release** Check this option if the release has to be marked as a pre-release. This option is ignored in case of *delete* action.

* **Add Changelog:** Using this option you can generate and append list of changes to release notes. The list of changes(commits and issues) between this and last published release will be generated and appended to release notes. Maximum number of changes shown is 250.
