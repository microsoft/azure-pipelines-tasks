/**
 * Describes the errors thrown by this node module
 * 
 * @export
 * @class PrInjectorError
 * @implements {Error}
 */
export class PRInjectorError extends Error {
    constructor(public message: string) {
        super(message);
        this.name = 'PRInjectorError';
        this.message = message;
        this.stack = (<any>new Error()).stack;
    }

     public toString() {
         return this.name + ': ' + this.message;
     }
}

