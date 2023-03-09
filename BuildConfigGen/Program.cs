using System;
using System.CommandLine;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

class Program
{
    static void Main()
    {
        string taskTarget = @"C:\repos\azure-pipelines-tasks\Tasks\DownloadBuildArtifactsV0";
        string taskOutput = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0";
        string taskOutputNode16 = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0_Node16";

        string taskPath = Path.Combine(taskTarget, "task.json");
        string taskLocPath = Path.Combine(taskTarget, "task.loc.json");
        string packagePath = Path.Combine(taskTarget, "package.json");

        var taskJson = File.ReadAllText(taskPath);

        JsonNode taskNode = JsonNode.Parse(File.ReadAllText(taskPath))!;
        JsonNode taskLocNode = JsonNode.Parse(File.ReadAllText(taskLocPath))!;
        JsonNode packageNode = JsonNode.Parse(File.ReadAllText(packagePath))!;

        var n = GetNodePath(taskNode, "version", "Patch");
        n = "2";

        n = GetNodePath(packageNode, "dependencies", "@types/node");
        n = "^16.11.39";

        taskNode.AsObject()?.Remove("_buildConfigMapping");

        taskNode.AsObject().Add("_buildConfigMapping", new JsonObject
        {
            ["Default"] = "0.219.1",
            ["Node16"] = "0.219.2"
        });

        //taskNode.Dump();
        //packageNode.Dump();

        var paths = GetNonIgnoredFileListFromPath(taskTarget);

        foreach (var o in paths)
        {
            //Console.WriteLine(o);
            string sourcePath = Path.Combine(taskTarget, o);
            string targetPath = Path.Combine(taskOutput, o);
            Console.WriteLine(targetPath);
            //CopyFile(sourcePath, targetPath);

        }
    }

    private static void CopyFile(string sourcePath, string targetPath)
    {
        Console.WriteLine($"Copy from={sourcePath} to={targetPath}");
    }

    private static IEnumerable<string> GetNonIgnoredFileListFromPath(string taskTarget)
    {
        var output = GitLsFiles(taskTarget);
        var untrackedOuput2 = GetUntrackedFiles(taskTarget);
        var paths = output.Union(untrackedOuput2);
        return paths;
    }

    private static IEnumerable<string> GetUntrackedFiles(string taskTarget)
    {
        int exitCode2;
        string[] untrackedOutput;
        const string gitaddDryRun = "add * --dry-run";
        if ((exitCode2 = RunCommandWithExitCode("git", gitaddDryRun, taskTarget, out untrackedOutput)) == 0)
        {

        }
        else
        {
            throw new Exception("non-zero exit code");
        }
        List<string> untrackedOuput2 = new();
        const string fileNameGroup = "fileNameGroup";

        const string addPattern = $@"^add '(?<{fileNameGroup}>.*)'$";
        Regex re = new Regex(addPattern, RegexOptions.Singleline);
        foreach (var o in untrackedOutput)
        {
            Match? m = null;
            if (null != (m = re.Match(o)))
            {
                //Console.WriteLine(m.Groups[fileNameGroup].Value);
                untrackedOuput2.Add(m.Groups[fileNameGroup].Value);
            }
            else
            {
                throw new Exception($"unexpected line from output didn't match regex. {nameof(o)}={o}  {nameof(gitaddDryRun)}={gitaddDryRun} {nameof(addPattern)}={addPattern}");
            }
        }

        return untrackedOuput2;
    }

    private static IEnumerable<string> GitLsFiles(string taskTarget)
    {
        int exitCode;
        string[] output;
        if ((exitCode = RunCommandWithExitCode("git", "ls-files", taskTarget, out output)) == 0)
        {
        }
        else
        {
            throw new Exception("non-zero exit code");
        }

        return output;
    }

    private static JsonNode GetNodePath(JsonNode node, string path0, params string[] path)
    {
        JsonNode ret;
        int index = 0;
        string p = path0;

        do
        {
            JsonNode? currentNode = node[p];

            if (currentNode == null)
            {
                throw new Exception($"expected {p} at {index}, path={string.Join(',', path)}");
            }

            ret = currentNode;
            index++;

            if (index < path.Length)
            {
                p = path[index];
            }
        } while (index < path.Length);

        return ret;
    }

    static int RunCommandWithExitCode(string program, string args, string workingDir, out string[] output)
    {
        using (Process p = new Process())
        {
            p.StartInfo.FileName = program;
            p.StartInfo.Arguments = args;
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.WorkingDirectory = workingDir;
            p.StartInfo.RedirectStandardOutput = true;
            p.Start();

            List<string> sb = new();
            string? line;
            while ((line = p.StandardOutput.ReadLine()) != null)
            {
                sb.Add(line);
            }

            output = sb.ToArray();

            p.WaitForExit();
            return p.ExitCode;
        }
    }
}