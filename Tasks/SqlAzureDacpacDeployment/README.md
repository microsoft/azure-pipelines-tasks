# Azure SQL Database Deployment

### Overview:

The task is used to deploy Azure SQL Database to an existing Azure SQL Server, and the underlying technologies used by the task are [DACPAC](https://msdn.microsoft.com/en-IN/library/ee210546.aspx) and [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx). DACPACs and SqlPackage.exe provide fine-grained control over database creation and upgrades, including upgrades for schema, triggers, stored procedures, roles, users, extended properties etc. Using the task, 80 different properties can be set to ensure that the database is created or upgraded properly, like:

- Ignore Data Loss - If false, upgrade will fail if it results in a data-loss.
- Verify Deployment - If true, the deployment is verified and blocked if can fail. For example, foreign keys have not been specified in the DACPAC but exist in the target database.
- Block on Changes - If true, upgrade is terminated if a schema drift is detected.
- Rollback on Failure - If true, then the upgrade is rolled back if errors are encountered.
- Backup Database Before Changes - If true, a backup of the database is taken prior to applying the changes.

### Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, if you would like to share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, then do send an email to the alias.

### Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

##### Azure Subscription

To deploy to Azure SQL Database, an Azure subscription has to be linked to Team Foundation Server or to Visual Studio Online using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

- For Azure Classic resources use 'Azure' endpoint type with Certificate or Credentials based authentication. If you are using credentials based auth, ensure that the credentials are for a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported. 

- For [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/), use 'Azure Resource Manager' endpoint type, for more details follow the steps listed in the link [here](http://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

For Azure MSDN accounts, one can either use a [Service Principal](http://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the account in VSO:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in the VSO and deployments will work with that account.

##### Azure SQL Server

There should be a Azure SQL Server that is already pre-created in the [Azure portal](https://ms.portal.azure.com/?r=1#create/Microsoft.SQLDatabase.0.5.7-preview). The task deploys Azure SQL Databases but does not create Azure SQL Server.

##### Automation Agent

The task runs on the automation agent machine and the following needs to be installed on the machine:

1. SqlPackage.exe is used to create or upgrade the database and can be installed by using any one of the following -
    * Visual Studio 2015 installs the SqlPackage.exe at - C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\SQLDB\DAC\120. Here the install location of Visual Studio is - C:\Program Files (x86)\Microsoft Visual Studio 14.0.
    * Install it by using the [Microsoft Web Platform Installer](http://www.microsoft.com/web/gallery/install.aspx?appid=DACFX) (Web PI). Note that the link will open Web PI with the DACFX showing-up ready to install, where the DACFX download represents all the MSIs that need to be installed for SqlPackage.exe.
    * [SQL Server Management Studio](https://www.microsoft.com/en-in/download/details.aspx?id=42299) for SQL Server 2014 or SQL Server Express or SQL Server 2012 and SQL Server 2014 and [DAC Framework](http://www.microsoft.com/en-us/download/details.aspx?id=42293) MSIs install SqlPackage.exe at C:\Program Files (x86)\Microsoft SQL Server\120\DAC\bin.

##### Azure PowerShell

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015). Refer to "Supported Azure and AzureRM module versions" section below for recommended versions.

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

- **Azure Connection Type**\*: Specify Azure endpoint type, for Azure Classic resources use 'Azure' endpoint, for Azure ARM resources use 'Azure Resource Manager' endpoint.
 
- **Azure Subscription\*:** Select the Azure Subscription where the Azure SQL Database will be deployed.

- **DACPAC File\*:** Location of the DACPAC file on the automation agent or on a UNC path that is accessible to the automation agent like, \\BudgetIT\Web\Deploy\FabrikamDB.dacpac. Predefined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) like, $(agent.releaseDirectory), can be also used here. Be sure to specify the full path like $(Build.Repository.LocalPath)\BudgetIT\Fabrikam.dacpac.

- **Server Name\*:** The connection string for the Azure SQL Server and the format is same as that is followed in SQL Server Management Studio. For example, FabrikamSQL.database.windows.net, 1433 or FabrikamSQL.database.windows.net are both valid Azure SQL Server names.

- **Database Name\*:** The name of the Azure SQL Database like FabrikanDB. The Database will be created new if it does not exist, else it will be updated if it already exists.

- **SQL Username\*** : Azure SQL Database task uses SQL Authentication to authenticate with the Azure SQL Server and this parameter specifies the Azure SQL Database administrator login.

- **SQL Password\*:** The password for the Azure SQL Database administrator.

- **Publish Profile:** Publish profile provide fine-grained control over Azure SQL Database creation or upgrades. Specify the path to the Publish profile XML file on the automation agent or on a UNC share that is accessible by the automation agent. As described for the DACAC file location, system variables or wildcards can be also used here. This is an optional parameter.

- **Additional SqlPackage.exe Arguments:** Additional SqlPackage.exe arguments that will be applied when creating or updating the Azure SQL Database like:
    /p:IgnoreAnsiNulls=True /p:IgnoreComments=True

	These arguments will override the settings in the Publish profile XML file (if provided). A full list of the arguments that can provided is listed in the ' **Properties**' sub-section of the ' **Publish Parameters, Properties, and SQLCMD Variables**' in the [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx) documentation. The SQLCMD variables can be also specified here. This is an optional parameter.

- **Specify Firewall Rules Using\*** : For the task to run, the IP Address of the automation agent has to be added to the 'Allowed IP Addresses' in the Azure SQL Server's Firewall. Provide the IP Address range of the automation agents, or select to auto-detect the IP Address of the agent where this task will run.

- **Start IP Address\*:** The starting IP Address of the automation agent machine pool like 196.21.30.50.

- **End IP Address\*:** The ending IP Address of the automation agent machine pool like 196.21.30.65.

- **Delete Rule After Task Ends\*:** If selected then after the task ends, the IP Addresses specified here are deleted from the 'Allowed IP Addresses' list of the Azure SQL Server's Firewall.

### Known Limitations :

- The auto-detection of the automation agent's IP Address only works with hosted automation agent in Visual Studio Team Services (VSTS) and not in Team Foundation Server (TFS).
- The Azure SQL Database Deployment task does not support BACPAC and SQL scripts. The SqlPackage.exe provides out-of-box support for both BACPAC and SQL Scripts and the work to enable this support is in our backlog. Please send us feedback for the task and for the support for BACPAC and SQL scripts at RM\_Customer\_Queries at microsoft dot com.

### Supported Azure and AzureRM module versions:
Recommended: 
[Azure PowerShell Installer v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015)

Other supported versions:
[Azure PowerShell Installer v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)