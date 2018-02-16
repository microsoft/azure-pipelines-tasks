## Troubleshooting
Checkout how to troubleshoot failures and collect debug logs: https://docs.microsoft.com/en-us/vsts/build-release/actions/troubleshooting

## Diagnostic Logs
In order to ease the debugging process we have enabled a feature called diagnostic logs. With this setting turned on we capture more verbose logs about the task, agent, and environment within which the build was run. In order to get access to these logs go to the build summary page and look for the "Queue new build" button. To the right of the button you will see a dropdown and a second option to "Queue new build with diagnostic logs". Select this option. A new build will be queued. Once the build is complete there are two ways to access these logs: (1) There will be a Diagnostic logs section on the build summary page and (2) you can click to "Download all logs as zip". These logs will help you debug your issues and help us assist you in debugging them.

## Environment
- Server - VSTS or TFS on-premises?
    
    - If using TFS on-premises, provide the version: 
    
    - If using VSTS, provide the account name, team project name, build definition name/build number: 


- Agent - Hosted or Private: 
    
    - If using Hosted agent, provide agent queue name:

    - If using private agent, provide the OS of the machine running the agent and the agent version: 

## Issue Description

[Include task name(s), screenshots and any other relevant details]

### Error logs

[Insert error from the logs here]