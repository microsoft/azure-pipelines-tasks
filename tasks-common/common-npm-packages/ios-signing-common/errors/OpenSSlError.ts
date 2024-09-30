export class OpenSSlError extends Error{
    constructor(message: string){
        super(message);
        Object.setPrototypeOf(this, OpenSSlError.prototype);
    }
}