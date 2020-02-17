import task = require('azure-pipelines-task-lib/task');
var winreg = require('winreg');
import Q = require('q');

export class ToolPathOperations {

    /**
     * Get installed path of mysql either it is linux or windows 
     */
    public async getInstalledPathOfMysql(): Promise<string> {
        let defer = Q.defer<string>(); 
        // To check either it is linux or windows platform
        if(task.osType().match(/^Win/)){
            this.getInstalledPathOfMysqlForWindow().then((path) => {
                defer.resolve(path);
            },(error) =>{
                task.debug("Error during window mysql path finding: "+ error);
                defer.reject(task.loc("WindowMysqlClientMissingError"));
            });
        }
        else{
            // linux check
            this.getInstalledPathOfMysqlForLinux().then((path) => {
                defer.resolve(path);
            },(error) =>{
                task.debug("Error during linux mysql path finding: "+ error);
                defer.reject(task.loc("LinuxMysqlClientMissingError"));
            });  
        }

        return defer.promise;
    }


    /**
     * Get installed path of mysql for Linux  
     */
    public async getInstalledPathOfMysqlForLinux(): Promise<string> {
        let defer = Q.defer<string>();
        try{
            const path = task.which("mysql", true);
            defer.resolve(path);
        }catch(error){
            defer.reject(error);
        }

        return defer.promise;
    }

     /**
     * Get installed path of mysql for windows 
     */
    public async getInstalledPathOfMysqlForWindow(): Promise<string> {
        let defer = Q.defer<string>();
        // If user has installed 32 bit mysql client in 64 bit machine
        this.getInstalledLocationFromPath("\\Software\\Wow6432Node\\MySQL AB").then((path) => {
            task.debug('Window Wow6432 mysql executable path: '+path);
            defer.resolve(path + "bin\\mysql.exe");
        },(error) =>{
            task.debug("Error during finding of Window Wow6432 mysql executable path: "+ error);
            this.getInstalledLocationFromPath("\\Software\\MySQL AB").then((path) => {
                task.debug('Window mysql executable path: '+path);
                defer.resolve(path + "bin\\mysql.exe");
            },(error) =>{
                task.debug("Error during finding of Window mysql executable path: "+ error);
                try{
                    const path = task.which("mysql", true);
                    if(path){
                        task.debug('Window mysql executable path from enviroment variable: '+path);
                        defer.resolve(path);
                    }else{
                        defer.reject(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                    } 
                }
                catch(exception){
                    task.debug("Error during finding of Window mysql executable path from environment path: "+ exception);
                    defer.reject(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                }            
            });
        });
        return defer.promise;
    }


    /**
     * Get installed location from path
     * @param path     path of window registry 
     * 
     * @returns        installed path
     */
    public async getInstalledLocationFromPath(path: string): Promise<string> {
        let defer = Q.defer<string>();
        task.debug('Getting executable path of mysql client for registry path: '+ path);
        this._getToolRegKeyFromPath(path).then((regKey) => {
            this._getToolInstalledPathFromRegKey(regKey).then((installedPath) => {
                defer.resolve(installedPath);
            },(error) =>{
                defer.reject(error);
            })
        },(error) =>{
            defer.reject(error);
        });

        return defer.promise;
    }

    /**
     * Get resgistry key from path 
     * @param path  path of window registry
     * 
     * @returns     registry key   
     */
    private _getToolRegKeyFromPath(path: string): Q.Promise<string> {
        var defer = Q.defer<string>();
        var regKey = new winreg({
          hive: winreg.HKLM,
          key:  path
        });
    
        regKey.keys(function(err, subRegKeys) {
            if(err) {
                task.debug('Error during fetching registry key from path: '+ err);
                defer.reject(new Error(task.loc("UnableToFindMysqlFromRegistryOnMachineError", err)));
            }
            let resgistryKeyResult: string;
            if(subRegKeys){
                for(var index in subRegKeys) {
                    let subRegKey: string = subRegKeys[index].key;
                    if(subRegKey.match("MySQL Server")){
                        task.debug('Window mysql registry key: '+ subRegKey);
                        resgistryKeyResult = subRegKey;
                    }
                }
            }
            if(resgistryKeyResult){
                defer.resolve(resgistryKeyResult);
            }else{
                defer.reject(new Error(task.loc("UnableToFindMysqlFromRegistry")));
            }      
        });

        return defer.promise;
    }

    /**
     * Get installed path from registry key
     * @param registryKey   window registry key
     * 
     * @returns             installed path
     */
    private _getToolInstalledPathFromRegKey(registryKey: string): Q.Promise<string> {
        var defer = Q.defer<string>();
        var regKey = new winreg({
          hive: winreg.HKLM,
          key:  registryKey
        });
    
        regKey.get("Location", function(err,item) {
            if(err) {
                task.debug('Error during fetching installed path from registry key: '+ err);
                defer.reject(new Error(task.loc("UnableToFindTheLocationOfMysqlFromRegistryOnMachineError", err)));
            }else{
                task.debug('Window mysql installed path from registry key: '+ item.value);
                defer.resolve(item.value);
            }
        });
    
        return defer.promise;
    }
}
