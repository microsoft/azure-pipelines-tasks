// Data class representing an HTTP/HTTPS response from the SonarQube server.
export class RestResponse {
    constructor(public statusCode:number, public payload:string) {
    }

    public wasSuccess():boolean {
        return (this.statusCode >= 200 && this.statusCode < 300);
    }

    public payloadToJson():Object {
        if (!this.payload || this.payload.length < 1) {
            return {};
        } else {
            return JSON.parse(this.payload);
        }
    }
}
