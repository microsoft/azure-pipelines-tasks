using System;
using System.CommandLine;
using System.Text.Json.Nodes;

class Program
{
    static void Main()
    {
        string taskTarget = @"C:\repos\azure-pipelines-tasks\Tasks\DownloadBuildArtifactsV0";

        string taskPath = Path.Combine(taskTarget, "task.json");
        string taskLocPath = Path.Combine(taskTarget, "task.loc.json");
        string packagePath = Path.Combine(taskTarget, "package.json");

        var taskJson = File.ReadAllText(taskPath);

        JsonNode taskNode = JsonNode.Parse(File.ReadAllText(taskPath))!;
        JsonNode taskLocNode = JsonNode.Parse(File.ReadAllText(taskLocPath))!;
        JsonNode packageNode = JsonNode.Parse(File.ReadAllText(packagePath))!;

        taskNode["version"]["Patch"] = "2";
        packageNode["dependencies"]["@types/node"] = "^16.11.39";

        taskNode.AsObject()?.Remove("_buildConfigMapping");

        taskNode.AsObject().Add("_buildConfigMapping", new JsonObject
        {
            ["Default"] = "0.219.1",
            ["Node16"] = "0.219.2"
        });


    }
}