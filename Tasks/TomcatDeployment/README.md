#Tomcat Deployment Task

###Overview
Deploy your Java Web application with Tomcat 6,7 or 8. The Tomcat task uses HTTP-based scripting interface to the Tomcat manager application that ships with Tomcat.
 
###Features
* Deploy / Re-deploy to Tomcat manager. Copies the war file to the target automatically.
* Use pre-defined Build / Release Variables or your own custom variables.
 
###Prerequisites
* Curl should be installed on the Build/Release agent.
* Tomcat is configured with the manager up and running.
* Automation agent is a Windows machine.  (We don’t support this task in xPlat yet).

###Compatibility
* We support Tomcat 6.x, 7.x and 8.x

###Task Parameters
|  Parameter Name                       |  Description                                                                                                                                                                      |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|  Tomcat Server URL                    | <ul><li> The URL for the Tomcat Server e.g. http://localhost:8080</li><li>We append "/manager" to your Server URL to talk to the Tomcat manager.</li></ul>                        |
|  Tomcat Manager Username And Password | <ul><li>These should match the credentials set in conf/tomcat-users.xml when you configured Tomcat.</li><li>The user should have "manager-script" role set.</li></ul>             |
|  Application Context                  | Specifies where the application should sit on the Tomcat server once deployed e.g. /Test                                                                                          |
|  WAR File                             | <ul><li>The absolute path to the WAR file.</li><li>Use Build Variables to fill in the path of the agent e.g. $(Agent.BuildDirectory)\$(Build.Repository.Name)\Demo.war</li></ul>  |
|  Tomcat Server Version                | <ul><li>Choose the appropriate Tomcat Server Version.</li><li>We support: Tomcat 6.x, 7.x and 8.x</li></ul>                                                                       |

###Known Issues
* If context path contains special characters which tomcat does not support, deployment will fail, task logs also prompt so, but task will pass.
 