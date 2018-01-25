import task = require('vsts-task-lib/task');
var winreg = require('winreg');
import Q = require('q');

export class ToolPathOperations {

    /**
     * Get installed path of mysql either it is linux or windows 
     */
    public async getInstalledPathOfMysql(): Promise<string> {
        let defer = Q.defer<string>();
        let path: string; 
        // To check either it is linux or windows platform
        if(process.platform !== 'win32'){
            // linux check
            path = task.which("mysql", true);
            defer.resolve(path);
        }
        else{
            try{
                // If user has installed 32 bit mysql client im 64 bit machine
                path = await this.getInstalledLocationFromPath("\\Software\\Wow6432Node\\MySQL AB");
                defer.resolve(path + "\\bin\\mysql.exe");
            }catch(exception){
                task.debug(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                try{
                    // If mysql client platform and host is same either both is 32 or both is 64
                    path = await this.getInstalledLocationFromPath("\\Software\\MySQL AB");
                    defer.resolve(path + "\\bin\\mysql.exe");
                }catch(exception){
                    task.debug(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                    // Extract from environment variable
                    path = task.which("mysql", true);
                    defer.resolve(path + "\\bin\\mysql.exe");
                }
    
            }
        }   
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
        try{
            const regKey = await this._getToolRegKeyFromPath(path);
            const installedPath = await this._getToolInstalledPathFromRegKey(regKey);
            defer.resolve(installedPath);
        }
        catch(exception) {
            throw new Error(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
        }
        return defer.promise;
    }

    /**
     * Get resgistry key from path 
     * @param path  path of window registry
     * 
     * @returns     registry key   
     */
    private _getToolRegKeyFromPath(path: string): Q.Promise<string> {
        let toolPath: string;
        var defer = Q.defer<string>();
        var regKey = new winreg({
          hive: winreg.HKLM,
          key:  path
        });
    
        regKey.keys(function(err, subRegKeys) {
            if(err) {
                throw new Error(task.loc("UnabletofindtheMysqlfromregistryonmachineError", err));
            }
            for(var index in subRegKeys) {
                let subRegKey: string = subRegKeys[index].key;
                if(subRegKey.match("MySQL Server")){
                    defer.resolve(subRegKey);
                }
            }

            throw new Error(task.loc("UnabletofindMysqlfromregistryonmachine"));
             
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
                throw new Error(task.loc("UnabletofindthelocationfromregistryonmachineError", err));
            }
            defer.resolve(item.value);
        });
    
        return defer.promise;
    }
}
