**Azure SQL Database Deployment**

**Overview:**

The task is used to deploy Azure SQL Database and the underlying technologies used by the task are [DACPAC](https://msdn.microsoft.com/en-IN/library/ee210546.aspx) and [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080(v=vs.103).aspx). DACPACs and SqlPackage.exe provide a fine-grained control over DB upgrades, including upgrades for schema, triggers, stored procedures, roles, users, extended properties etc. Using the task, 80 different properties to ensure that the production DB is upgraded properly, like:

- Ignore Data Loss - If false, upgrade will fail if it results in a data-loss.
- Verify Deployment - If true, the deployment is verified and blocked if can fail. For example, foreign keys have not been specified in the DACPAC but exist in the target DB.
- Block on Changes - If true, upgrade is terminated if a schema drift is detected.
- Rollback on Failure - If true, then the upgrade is rolled back if errors are encountered.
- Backup DB Before Changes - If true, a backup of the DB is taken prior to applying the changes.

**Pre-requisites for the task:**

**Azure Subscription**

To deploy to Azure SQL Database, an Azure subscription has to be linked to VSO using the Services tab in the Account Administration section.

Add the Azure subscription to use in the Build tasks by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services tab. Select Azure from the Add New Service Connection dropdown.

Fill in the required details from the Azure account, and select credentials for authentication as certificates are not supported by Azure Resource Manager. **The credentials have to be a** [work account](http://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) **like** [joe@fabrikam.com](mailto:joe@fabrikam.com) **because Microsoft accounts like** [joe@live.com](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) **or** [joe@hotmail.com](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) **are not supported.**

_NOTE: Currently the Azure SQL Database Deployment task will not work for accounts that have two factor authentication enabled, to support this ability to specify_ [Service Principal](https://azure.microsoft.com/en-in/documentation/articles/resource-group-create-service-principal-portal/) _in the Service Connections is coming soon._

**Azure SQL Server**

There should be a Azure SQL Server that is already pre-created in the [Azure portal](https://ms.portal.azure.com/?r=1#create/Microsoft.SQLDatabase.0.5.7-preview). The tasks deploy Azure SQL Databases but does not create Azure SQL Server.

**Automation Agent**

The task runs on the automation agent machine and the following needs to be installed on the machine:

1. SqlPackage.exe needs to be installed on the automation agent and can be done using any one of the following -
  a. Visual Studio 2015 install the SqlPackage.exe at - C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\SQLDB\DAC\120. Here the install location of Visual Studio is - C:\Program Files (x86)\Microsoft Visual Studio 14.0.
  b. Install it by using the [Microsoft Web Platform Installer](http://www.microsoft.com/web/gallery/install.aspx?appid=DACFX) (Web PI), where the DACFX download represents all the MSIs that need to be installed for SqlPackage.exe. Note that the link will open Web PI with the DACFX already ready to install.
  c. [SQL Server Management Studio](https://www.microsoft.com/en-in/download/details.aspx?id=42299) for SQL Server 2014 or SQL Server Express and [DAC Framework](http://www.microsoft.com/en-us/download/details.aspx?id=42293) MSIs install SqlPackage.exe at C:\Program Files (x86)\Microsoft SQL Server\120\DAC\bin.
2. The Azure PowerShell needs to be installed on the automation agent and it can be done easily using the [Microsoft Web Platform Installer](http://go.microsoft.com/fwlink/p/?LinkId=320376) (Web PI). Note that the link will open Web PI with the Azure PowerShell already to install.

**Parameters of the task:**

- **Azure Subscription:** Select the Azure Subscription where the Azure SQL DB will be deployed. This is a drop down of the subscriptions that have been added in the Services tab. Note that select only the Azure Subscription that have been specified to use credentials. Certificate based authentication are not supported.

- **DACPAC File:** Location of the DACPAC file on the automation agent or on a UNC path that is accessible to the automation agent like, \\BudgetIT\Web\Deploy\FabrikamDB.dacpac. Predefined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) like, $(agent.releaseDirectory), can be also used here. Be sure to specify the full path like $(Build.Repository.LocalPath)\BudgetIT\Fabrikam.dacpac. Wildcards like \*\*\\*.dacpac are also supported and there needs to be only file that matches the search pattern at the location. If more than one file matches the search pattern, then the task will error out.

- **Server Name:** The connection string for the Azure SQL Server and the format is same as that is followed in SQL Server Management Studio. For example, FabrikamSQL.database.windows.net, 1433 or FabrikamSQL.database.windows.net are both valid Azure SQL Server names.

- **Database Name:** The name of the Azure SQL Database like FabrikanDB. The Database will be created new if it does not exist, else if it exits it will be updated.

- **SQL Username** : Azure SQL DB uses SQL Authentication and the parameter specifies the Azure SQL Database administrator login.

- **SQL Password:** The password for the Azure SQL Database administrator.

- **Publish Profile:** Publish profile provide fine-grained control over Azure SQL Database creation or upgrades. Specify the path to the Publish profile XML file on the automation agent or on a UNC share that is accessible by the automation agent. System variables as described earlier can be also used here.

- **Additional SqlPackage.exe Arguments:** Additional SqlPackage.exe arguments that will be applied when creating or updating the Azure SQL Database like:

 /p:IgnoreAnsiNulls=True /p:IgnoreComments=True

These arguments will override the settings in the Publish profile XML file (if provided). A full list of the arguments that can provided is listed in the ' **Properties**' sub-section of the 'Publish Parameters, Properties, and SQLCMD Variables' in the [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080(v=vs.103).aspx) documentation. The SQLCMD variables can be also specified here.

- **Specify Firewall Rules Using** : For the task to run, the IP Address of the automation agent has to be added to the 'Allowed IP Addresses' in the Server's Firewall. Provide the IP Address range of the automation agents or select to auto-detect the IP Address of the agent where the tasks runs.

- **Start IP Address:** The starting IP Address of the automation agent machine pool like 196.21.30.50.

- **End IP Address:** The ending IP Address of the automation agent machine pool like 196.21.30.65.

- **Delete Rule After Task Ends:** If selected, after the task ends, the IP Addresses specified here are deleted from the 'Allowed IP Addresses' list of the Server's Firewall

**Known Issues**

- The auto-detection of the automation agent IP Addresses only works in VSO and not in TFS.