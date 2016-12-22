export function findFiles (projects: string, includeFolder: boolean) : string[] {
        if (projects == "**/project.json") {
            return ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"];
        }

        if (projects == "**/project.json;**/*.csproj") {
            return ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"];
        }

        if (projects == "*fail*/project.json") {
            return [];
        }

        if (projects == "*customoutput/project.json") {
            return ["web3/project.json", "lib2/project.json"]
        }

        return [projects];
    }