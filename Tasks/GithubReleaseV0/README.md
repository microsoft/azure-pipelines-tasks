#  GitHub Releases

## Overview

The GitHub Releases task can be used to create/edit/discard a GitHub release directly from your CI/CD pipeline. This task  works on cross platform Azure Pipeline agents running Windows, Linux or Mac and uses GitHub APIs to manage GitHub releases. 

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task
The following pre-requisites required for the task to work properly:

#### GitHub Service Connection
In order to perform operations on the GitHub repository, the task needs a GitHub service connection with adequate permission. If it does not exist already, you can [create a github service connection](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=vsts#sep-github) in for your azure pipelines project. Once the service connection is created, all you  need is the name of the service connection in this task.

## Parameters of the task

The GitHub Releases task can run in 3 action types, viz. create, edit or discard. Based on the action chosen by the user certain parameters will be ignored. The following is the list of parameters required for this task.


* **Service Connection:**  This is the name of GitHub service connection which will be used to connect to target GitHub account. You can use an existing GitHub service connection or create a new one. For more details, see: [create a github service connection](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=vsts#sep-github)

* **GitHub Repository:**  This is the name of the github repository where the github releases will be created. E.g. *microsoft/vscode*

* **Action:**  Action is the type of release operation you want perform using this task. This task can perform 3 different actions - create, edit or discard. 
                * Create: This action creates a github release. Throws error if a published release already exists with the given tag.
                * Edit: This action modifies a existing github release. Tag is used to identify the release to be edited. Throws error if more than 1 release(draft or published) is found with the given tag.
                * Discard: This action deletes a github release. Tag is used to identify the release to be deleted. Throws error if more than 1 release(draft or published) is found with the given tag. 

* **Target:** This is the commit SHA for which the github release will be created. By default, the value is $(Build.SourceVersion) which corresponds to the commit for which the build was run. This field is ignored when using edit and discard actions.

* **Tag:** This field allows you to configure the tag to be used for a release action. It can be done in 2 ways:
                * Use tag associated with commit: This option is available only for create release action. If selected, the release will be created ~~using the latest tag~~ that is associated with this commit. 
                * Use specified tag: When this option is used, the release will be created using the tag mentioned. You can also mention the tag using variables,  Eg. v\$(MajorVersion).\$(MinorVersion).\$(PatchVersion). For release edit and discard actions, it is mandatory to use this option. 
                
* **Release Title:** This is the title that will be used for release creation. If left empty, the tag name will be used as the release title.
* **Release Notes:** This field lets you specify the description of your github release. You can either select a file which contains release notes or can type the contents directly. If a file is selected, the contents of that file will be copied as the release notes. If there is no file selected or no text is provided, the github release will be successful but description will be empty.
* **Add Changelog:** Using this option you can generate and append list of changes to release notes. The list of changes(commits and issues) between this and last published release will be generated and appended to release notes. 
* **Assets** These are the files that will be uploaded as assets for the release. You can use wild characters to specify a set of files. All the matching files shall be uploaded. You can also specify multiple patterns - one path per line. By default, it uploads the contents of $(Build.ArtifactStagingDirectory). If the specified folder is missing, it throws a warning. 
* **Asset Upload Mode** This option is used in case of editing a release. There are 2 ways in which assets can be uploaded.
                * Delete existing assets: When using this option, the task will first delete any existing assets in the release and upload all the assets once again.
                * Replace existing assets: When using this option, the task will replace any assets that have the same name. Assets that do not have a name conflict will be present in the newer release.
* **Draft Release** This option specifies if the release has to be saved as a draft release or a published release.
* **Pre Release** This option specifies if the release has to be marked as a pre-release.
