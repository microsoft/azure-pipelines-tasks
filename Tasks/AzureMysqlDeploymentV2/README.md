# Azure Database for MySQL Flexible Server Deployment 
 
 
### Overview: 
 
The task is used for deploying to Azure Database for MySQL Flexible Server. There are two ways to deploy, either using a script file or writing the script in our inline editor. 
 
This V2 task targets Azure Database for MySQL Flexible Server, which is the recommended deployment model for MySQL on Azure.
 
 
### Contact Information 
 
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.
 
 
### Pre-requisites for the task 
The following pre-requisites need to be setup for the task to work properly. 
 
 
##### Azure Subscription 
 
To deploy to Azure Database for MySQL, an Azure subscription has to be linked to Team Foundation Server or to Azure DevOps using the Service connections tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. 
Use 'Azure Resource Manager'([ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/)) endpoint type; for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409). 
 
 
 
##### Azure Database for MySQL Flexible Server resource 
This task expects that the Azure resource for [Azure Database for MySQL Flexible Server](https://docs.microsoft.com/en-us/azure/mysql/flexible-server/overview) is already available in the [Azure portal](https://ms.portal.azure.com/). The task can create a new database along with other MySQL commands but doesn't create the server. 

##### MySQL Client in agent box
This task expects MySQL client must be in agent box
- **Window Agent:** Use this [script file](https://aka.ms/window-mysqlcli-installer) to install MySQL client.
- **Linux Agent:**  Run command 'apt-get install mysql-client' to install MySQL client.
 
### Parameters of the task: 
The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task: 
 
 
- **Display name\*:** Provide a name to identify the task among others in your pipeline. 
 
 
- **Azure subscription\*:** Select the Azure Subscription to connect to the portal where the Azure resource is present. 
 
 
**DB Details** 
 
 
- **Host name\*:** Server name of "Azure Database for MySQL Flexible Server". Example: fabrikam.mysql.database.azure.com. When you connect using MySQL Workbench, this is the same value that is used for "Hostname" in "Parameters".  
 
- **Database name:**  The name of database, if you already have one, on which the below script is needed to be run, else the script itself can be used to create the database. 
 
- **Server admin login\*:** Azure Database for MySQL Flexible Server supports native MySQL authentication. You can connect and authenticate to a server with the server's admin login. Example: bbo1. 
