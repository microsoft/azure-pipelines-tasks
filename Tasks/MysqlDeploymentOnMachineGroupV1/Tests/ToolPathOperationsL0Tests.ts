import tl = require('azure-pipelines-task-lib');
import { ToolPathOperations } from '../operations/ToolPathOperations';

export class ToolPathOperationsL0Tests  {

    public static toolPathOperations: ToolPathOperations = new ToolPathOperations();

    public static async startToolPathOperationsL0Tests() {
        await ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux();
    }

    public static async getInstalledPathOfMysqlForLinux(){
        try{
            const mysqlPath: string = await ToolPathOperationsL0Tests.toolPathOperations.getInstalledPathOfMysqlForLinux();
            console.log(" mysql path"+ mysqlPath);
            if(mysqlPath && mysqlPath == '/bin/mysql'){
                tl.setResult(tl.TaskResult.Succeeded, 'ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.');
            }else{
                tl.setResult(tl.TaskResult.Failed, 'ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed but failed.');  
            }
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed but failed due to error.');
        }
    }

}

ToolPathOperationsL0Tests.startToolPathOperationsL0Tests();