# Windows Machine File Copy Task
### Overview
The task is used to copy application files and other artifacts that are required to install the application on Windows Machines like PowerShell scripts, PowerShell-DSC modules etc. The task provides the ability to copy files to Windows Machines. The tasks uses RoboCopy, the command-line utility built for fast copying of data.

###The different parameters of the task are explained below:

*	**Source**: The source of the files. As described above using pre-defined system variables like $(Build.Repository.LocalPath) make it easy to specify the location of the build on the Build Automation Agent machine. The variables resolve to the working folder on the agent machine, when the task is run on it. Wild cards like **\*.zip are not supported.
* **Machines**: Specify comma separated list of machine FQDNs/ip addresses along with port(optional). For example dbserver.fabrikam.com, dbserver_int.fabrikam.com:5986,192.168.34:5986. Port when not specified will be defaulted to WinRM defaults based on the specified protocol. i.e., (For *WinRM 2.0*):  The default HTTP port is 5985, and the default HTTPS port is 5986. Machines field also accepts 'Machine Groups' defined under 'Test' hub, 'Machines' tab. 
* **Admin Login**: Domain/Local administrator of the target host. Format: &lt;Domain or hostname&gt;\ &lt; Admin User&gt;. Mandatory when used with list of machines, optional for Test Machine Group (will override test machine group value when specified). 
* **Password**:  Password for the admin login. It can accept variable defined in Build/Release definitions as '$(passwordVariable)'. You may mark variable type as 'secret' to secure it. Mandatory when used with list of machines, optional for Test Machine Group (will override test machine group value when specified). 
*	**Destination Folder**: The folder in the Windows machines where the files will be copied to. An example of the destination folder is c:\FabrikamFibre\Web.
*	**Clean Target**: Checking this option will clean the destination folder prior to copying the files to it.
*	**Copy Files in Parallel**: Checking this option will copy files to all the machines in the Machine Group in-parallel, hence speeding up the process of copying.
