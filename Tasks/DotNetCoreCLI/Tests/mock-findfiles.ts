export function resolveFilterSpec (pattern: string, baseFolder: string) : string[] {
        if (pattern == "**/project.json") {
            return ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"];
        }

        if (pattern == "**/project.json;**/*.csproj") {
            return ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"];
        }
        
        if (pattern == "**/project.json;**/*.csproj;**/*.vbproj") {
            return ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"];
        }

        if (pattern == "*fail*/project.json") {
            return [];
        }

        if (pattern == "*customoutput/project.json") {
            return ["web3/project.json", "lib2/project.json"]
        }

        return [pattern];
}