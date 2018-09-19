# Azure Database for MySQL Deployment 
 
 
### Overview: 
 
The task is used to deploy for deploying to Azure Database for MySQL – Azure’s MySQL DB as a service. There are two ways to deploy, either using a script file or writing the script in our inline editor. 
 
 
### Contact Information 
 
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.
 
 
### Pre-requisites for the task 
The following pre-requisites need to be setup for the task to work properly. 
 
 
##### Azure Subscription 
 
To deploy to Azure Database for MySQL, an Azure subscription has to be linked to Team Foundation Server or to Azure DevOps using the Service connections tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. 
Use 'Azure Resource Manager'([ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/)) endpoint type; for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409). 
 
 
 
##### Azure Database for MySQL resource 
This tasks expects that the Azure resource for [Azure Database for MySQL](https://docs.microsoft.com/en-us/azure/mysql/overview) is already available in the [Azure portal](https://ms.portal.azure.com/?r=1#create/Microsoft.SQLDatabase.0.5.7-preview). The task can create a new database along with other MySQL commands but doesn't create the server. 

##### MySQL Client in agent box
This task expects MySQL client must be in agent box
- **Window Agent:** Use this [script file](https://aka.ms/window-mysqlcli-installer) to install MySQL client.
- **Linux Agent:**  Run command 'apt-get install mysql-client' to install MySQL client.
 
### Parameters of the task: 
The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task: 
 
 
- **Display name\*:** Provide a name to identify the task among others in your pipeline. 
 
 
- **Azure subscription\*:** Select the Azure Subscription to connect to the portal where the Azure resource is present. 
 
 
**DB Details** 
 
 
- **Host name\*:** Server name of “Azure DB for Mysql”.Example: fabrikam.mysql.database.azure.com. When you connect using MySQL Workbench, this is the same value that is used for "Hostname" in "Parameters".  
 
- **Database name:**  The name of database, if you already have one, on which the below script is needed to be run, else the script itself can be used to create the database. 
 
- **Server admin login\*:** Azure Database for MySQL server supports native MySQL authentication. You can connect and authenticate to a server with the server's admin login. Example:  bbo1@fabrikam.  
When you connect using MySQL Workbench, this is the same value that is used for "Username" in "Parameters".  
 
 
- **Password\*:** Administrator password for Azure DB for MySQL. In case you don’t recall the password you can change the password from [Azure portal](https://docs.microsoft.com/en-us/azure/mysql/howto-create-manage-server-portal).  
 
 
 
**Deployment Package** 
 
 
- **Type\*:** Select one of the options between Script File & Inline Script. 
 
 
**Script file:** Use this option if you have a text file that has the necessary SQL statements to be executed on server. 
 
 
- **Script path\*:** Full path of the script file on the automation agent or on a UNC path accessible to the automation agent like,  \\BudgetIT\DeployBuilds\script.sql. Also, predefined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) like, $(agent.releaseDirectory) can also be used here. 
 
 
- **Additional MySQL options:** Additional options supported by MySQL simple SQL shell.  These options will be applied when executing the given file on the Azure DB for MySQL. 
Example: You can change to default tab separated output format to HTML or even XML format. Or if you have problems due to insufficient memory for large result sets, use the --quick option. 
 
 
**Inline script:** Use this option for running the Inline Script against the server.  
 
 
- **Inline script\*:** Enter the actuall Script to be run. 
 
 
- **Additional MySQL options:** Additional options supported by MySQL simple SQL shell.  These options will be applied when executing the given file on the Azure DB for MySQL. 
Example: You can change to default tab separated output format to HTML or even XML format. Or if you have problems due to insufficient memory for large result sets, use the --quick option. 
 
 
 
**Firewall** 
 
 
- **Specify firewall rules using\*** : For successful execution of the task, we need to enable administrators to access the Azure Database for MySQL Server from the IP Address of the automation agent.  
By selecting auto-detect you can automatically add firewall exception for range of possible IP Address of automation agent  
or else you can specify the range explicitly. 
 
 
- **Start IP address\*:** The starting IP Address of the automation agent machine pool like 196.21.30.50. 
 
 
- **End IP address\*:** The ending IP Address of the automation agent machine pool like 196.21.30.65. 
 
 
- **Delete rule after task ends\*:** If selected, the added exception for IP addresses of the automation agent will be removed for corresponding Azure Database for MySQL.
