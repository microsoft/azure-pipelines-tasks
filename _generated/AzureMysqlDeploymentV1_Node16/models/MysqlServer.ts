import tl = require("azure-pipelines-task-lib/task");

export class MysqlServer {
    private name: string;
    private fullyQualifiedName: string;
    private resourceGroupName: string;

    constructor(name: string, fullyQualifiedName: string, resourceGroupName: string){
        if (!this.isNameValid(name)) {
            throw new Error(tl.loc("MysqlServerNameCannotBeEmpty"));
        }
        if (!this.isNameValid(fullyQualifiedName)) {
            throw new Error(tl.loc("MysqlFullyQualifiedServerNameCannotBeEmpty"));
        }
        if(!this.isNameValid(resourceGroupName)){
            throw new Error(tl.loc("ResourceGroupCannotBeEmpty"));
        }

        this.name = name;
        this.fullyQualifiedName = fullyQualifiedName;
        this.resourceGroupName = resourceGroupName;
    }

    public getResourceGroupName(): string{
        return this.resourceGroupName;
    }

    public getName(): string{
        return  this.name;
    }

    public getFullyQualifiedName(): string{
        return this.fullyQualifiedName;
    }

    private isNameValid(name: string): boolean{
        if (name === null || name === undefined || typeof name.valueOf() !== 'string') {
            return false;
        }else{
            return true;
        }
    }
}
