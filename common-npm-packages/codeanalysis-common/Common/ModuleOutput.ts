/**
 * Data class that describes a project module (in the Maven / Gradle sense) 
 * 
 * @export
 * @class ModuleOutput
 */
export class ModuleOutput {
    constructor(public moduleName: string, public moduleRoot: string) { }
}
