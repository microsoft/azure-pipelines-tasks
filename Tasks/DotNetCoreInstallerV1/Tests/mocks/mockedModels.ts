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

export class toolrunner {
    constructor(toolPath, outputToReturn) {
        this.toolPath = toolPath;
        this.outputToReturn = outputToReturn;
    }
    public line (somearg) {
        return this;
    }

    public arg (args) {
        return this;
    }

    public execSync() {
        if (this.outputToReturn) {
            return this.outputToReturn;
        }

        return {
            code: 0,
            error: null,
            stdout: "",
            stderr: ""
        }
    }

    private toolPath;
    private outputToReturn;
}