// Data class representing an HTTPS response from the SonarQube server.
export class RestResponse {
    constructor(public statusCode:number, public payload:string) {
    }

    public wasSuccess():boolean {
        return this.statusCode == 200;
    }

    public payloadToJson():Object {
        return JSON.parse(this.payload);
    }
}
