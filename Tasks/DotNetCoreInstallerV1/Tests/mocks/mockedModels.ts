export class HttpClientResponse {
    constructor(message) {
        this.message = message;
    }
    public readBody() {
        return new Promise((resolve, reject) => {
            resolve(this.message);
        })
    }
    message: string = ""
}