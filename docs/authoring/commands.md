## Logging Commands:

The general format for a logging command is:
    ##vso[area.action property1=value;property2=value;...]message

To invoke a logging command, simply emit the command via standard output. For example, from a PowerShell task:
```
"##vso[task.setvariable variable=testvar;]testvalue"
```

#### Task Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.logissue]error/warning message
                </p>
            </td>
            <td>
                <p align="left">
                    type=error or warning (Required) <br>
                    sourcepath=source file location <br>
                    linenumber=line number <br>
                    columnnumber=column number <br>
                    code=error or warning code <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Log error or warning issue to timeline record of current task.<br>
                    Example: <br>
                    ##vso[task.logissue type=error;sourcepath=consoleapp/main.cs;linenumber=1;columnnumber=1;code=100;]this is an error
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.setprogress]current operation
                </p>
            </td>
            <td>
                <p align="left">
                    value=percentage of completion
                </p>
            </td>
            <td>
                <p align="left">
                    Set progress and current operation for current task.<br>
                    Example: <br>
                    ##vso[task.setprogress value=75;]Upload Log
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.complete]current operation
                </p>
            </td>
            <td>
                <p align="left">
                    result=Succeeded|SucceededWithIssues|Failed|Cancelled|Skipped
                </p>
            </td>
            <td>
                <p align="left">
                    Finish timeline record for current task, set task result and current operation. When result not provide, set result to succeeded.<br>
                    Example: <br>
                    ##vso[task.complete result=Succeeded;]DONE
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.logdetail]current operation
                </p>
            </td>
            <td>
                <p align="left">
                    id=Timeline record Guid (Required)<br>
                    parentid=Parent timeline record Guid <br>
                    type=Record type (Required for first time, can't overwrite)<br>
                    name=Record name (Required for first time, can't overwrite)<br>
                    order=order of timeline record (Required for first time, can't overwrite)<br>
                    starttime=Datetime <br>
                    finishtime=Datetime <br>
                    progress=percentage of completion <br>
                    state=Unknown|Initialized|InProgress|Completed <br>
                    result=Succeeded|SucceededWithIssues|Failed|Cancelled|Skipped <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Create and update detail timeline records. <br>
                    The first time we saw ##vso[task.detail] for each task, we will create a detail timeline for the task. <br>
                    We will create and update nested timeline record base on id and parentid. <br>
                    Task author need to remember which Guid they used for each timeline record.
                    The logging system will keep tracking the Guid for each timeline records that been created, so any new Guid will result a new timeline record. <br>
                    Example: <br>
                    Create new root timeline record: ##vso[task.logdetail id=new guid;name=project1;type=build;order=1]create new timeline record.<br>
                    Create new nested timeline record: ##vso[task.logdetail id=new guid;parentid=exist timeline record guid;name=project1;type=build;order=1]create new nested timeline record.<br>
                    Update exist timeline record: ##vso[task.logdetail id=exist timeline record guid;progress=15;state=InProgress;]update timeline record
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.setvariable]value
                </p>
            </td>
            <td>
                <p align="left">
                    variable=variable name (Required) <br>
                </p>
                 <p align="left">
                    issecret=true (Optional) <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Sets a variable in the variable service of taskcontext. The first task can set a variable, and following tasks are able to use the variable. The variable is exposed to the following tasks as an environment variable. When 'issecret' is set to true, the value of the variable will be saved as secret and masked out from log.<br>
                    Example: <br>
                    ##vso[task.setvariable variable=testvar;]testvalue<br> 
                    ##vso[task.setvariable variable=testvar;issecret=true;]testvalue<br> 
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.addattachment]value
                </p>
            </td>
            <td>
                <p align="left">
                    type=attachment type (Required) <br>
                    name=attachment name (Required) <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Upload and attach attachment to current timeline record. <br>
                    Example: <br>
					##vso[task.addattachment type=myattachmenttype;name=myattachmentname;]c:\myattachment.txt<br> 
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[task.uploadsummary]local file path
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Upload and attach summary markdown to current timeline record. <br>
                    Example: <br>
                    ##vso[task.uploadsummary]c:\testsummary.md <br>
                    It is a short hand form for the command <br>
                    ##vso[task.addattachment type=Distributedtask.Core.Summary;name=testsummaryname;]c:\testsummary.md<br> 
                </p>
            </td>
            <td>
               0.5.6
            </td>
        </tr>
    </tbody>
</table>


#### Artifact Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    ##vso[artifact.associate]artfact location
                </p>
            </td>
            <td>
                <p align="left">
                    artifactname=artifact name (Required) <br>
                    type = artifact type (Required, supported artifact type: container, filepath, versioncontrol, gitref, tfvclabel)<br> 
                </p>
            </td>
            <td>
                <p align="left">
                    Create an artifact link, artifact location is required to be a file container path, VC path or UNC share path. <br>
                    Examples: <br>
                    ##vso[artifact.associate type=container;artifactname=MyServerDrop]#/1/build <br>
                    ##vso[artifact.associate type=filepath;artifactname=MyFileShareDrop]\\MyShare\MyDropLocation <br>
                    ##vso[artifact.associate type=versioncontrol;artifactname=MyTfvcPath]$/MyTeamProj/MyFolder <br>
                    ##vso[artifact.associate type=gitref;artifactname=MyTag]refs/tags/MyGitTag <br>
                    ##vso[artifact.associate type=tfvclabel;artifactname=MyTag]MyTfvcLabel <br>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[artifact.upload]local file path
                </p>
            </td>
            <td>
                <p align="left">
                    containerfolder=folder that the file will upload to, folder will be created if needed. (Required)<br>
                    artifactname=artifact name<br>
                </p>
            </td>
            <td>
                <p align="left">
                    Upload local file into a file container folder, create artifact if artifactname provided.<br>
                    Example: <br>
                    ##vso[artifact.upload containerfolder=testresult;artifactname=uploadedresult;]c:\testresult.trx<br>
                </p>
            </td>
            <td>
            </td>
    </tbody>
</table>


#### Build Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    ##vso[build.uploadlog]local file path
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Upload user interested log to build’s container “logs\tool” folder.<br>
                    Example: <br>
                    ##vso[build.uploadlog]c:\msbuild.log
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[build.updatebuildnumber]build number
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Update build number for current build.<br>
                    Example: <br>
                    ##vso[build.updatebuildnumber]my-new-build-number
                </p>
            </td>
            <td>
                1.88
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    ##vso[build.addbuildtag]build tag
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Add a tag for current build.<br>
                    Example: <br>
                    ##vso[build.addbuildtag]Tag_UnitTestPassed
                </p>
            </td>
            <td>
                1.95
            </td>
        </tr>
    </tbody>
</table>
