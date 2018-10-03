# MySQL Database Deployment On Machine Group
 
 
### Overview: 
 
The task is used to deploy for MySQL Database. There are two ways to deploy, either using a script file or writing the script in our inline editor. 
 
 
### Contact Information 
 
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.
 
 
### Pre-requisites for the task 
The following pre-requisites need to be setup for the task to work properly. 

##### MySQL Client in agent box
This task expects MySQL client must be in agent box
- **Window Agent:** Use this [script file](https://aka.ms/window-mysqlcli-installer) to install MySQL client.
- **Linux Agent:**  Run command 'apt-get install mysql-client' to install MySQL client.
 
### Parameters of the task: 
The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task: 
 
 
- **Display name\*:** Provide a name to identify the task among others in your pipeline. 
 
 - **Deploy MySql Using\*:** Select one of the options between Script File & Inline Script. 
 
 
   - **Script file:** Use this option if you have a text file that has the necessary SQL statements to be executed on server. 
 
 
      - **Script path\*:** Full path of the script file on the automation agent or on a UNC path accessible to the automation agent like,  \\BudgetIT\DeployBuilds\script.sql. Also, predefined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) like, $(agent.releaseDirectory) can also be used here. 
 
 
   - **Inline script:** Use this option for running the Inline Script against the server.  
 
 
      - **Inline script\*:** Enter the actuall Script to be run. 
 
- **Host name\*:** Server name of Mysql DB.Example: localhost. When you connect using MySQL Workbench, this is the same value that is used for "Hostname" in "Parameters".  
 
- **Database name:**  The name of database, if you already have one, on which the below script is needed to be run, else the script itself can be used to create the database. 
 
- **Mysql User Name\*:** When you connect using MySQL Workbench, this is the same value that is used for "Username" in "Parameters".  
 
 
- **Password\*:** When you connect using MySQL Workbench, this is the same value that is used for "Password" in "Parameters".  
 
 

- **Additional MySQL options:** Additional options supported by MySQL simple SQL shell. 
Example: You can change to default tab separated output format to HTML or even XML format. Or if you have problems due to insufficient memory for large result sets, use the --quick option. 
 
 

