import task = require('vsts-task-lib/task');
var winreg = require('winreg');
import Q = require('q');

export class ToolPathOperations {

    public async getInstalledPathOfMysql(): Promise<string> {
        let defer = Q.defer<string>();
        let path: string; 
        if(process.platform !== 'win32'){
            path = task.which("mysql", true);
            defer.resolve(path);
        }
        else{
            try{
                path = await this.getInstalledLocationFromPath("\\Software\\Wow6432Node\\MySQL AB");
                defer.resolve(path + "\\bin\\mysql.exe");
            }catch(exception){
                task.debug(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                try{
                    path = await this.getInstalledLocationFromPath("\\Software\\MySQL AB");
                    defer.resolve(path + "\\bin\\mysql.exe");
                }catch(exception){
                    task.debug(task.loc("NotAbleToGetInstalledLocationOfMysqlFromPath"));
                    path = task.which("mysql", true);
                    defer.resolve(path + "\\bin\\mysql.exe");
                }
    
            }
        }   
        return defer.promise;
    }

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