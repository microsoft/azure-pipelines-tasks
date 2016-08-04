// Simple data class for a SonarQube generic endpoint
export class SonarQubeEndpoint {
    constructor(public Url: string, public Username: string, public Password: string) {
    }
}