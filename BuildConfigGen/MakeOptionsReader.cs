using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace BuildConfigGen
{
    internal static class MakeOptionsReader
    {
        internal static Dictionary<string, AgentTask> ReadMakeOptions(string gitRootPath)
        {
            Dictionary<string, AgentTask> agentTasks = new Dictionary<string, AgentTask>();

            var r = new Utf8JsonReader(File.ReadAllBytes(Path.Combine(gitRootPath, @"make-options.json")));

            bool inConfig = false;
            bool underTasksNode = false;
            string configName = "";

            while (r.Read())
            {

                switch (r.TokenType)
                {
                    case JsonTokenType.PropertyName:
                        {
                            string? text = r.GetString();
                            //Console.WriteLine(r.TokenType + " " + text);

                            if (text == "taskResources")
                            {
                                // skip
                                inConfig = false;
                                underTasksNode = false;
                            }
                            else if (text == "tasks")
                            {
                                inConfig = false;
                                underTasksNode = true;
                            }
                            else
                            {
                                inConfig = true;
                                configName = text!;
                                underTasksNode = false;
                            }

                            break;
                        }
                    case JsonTokenType.String:
                        {
                            if(underTasksNode && inConfig)
                            {
                                throw new Exception("don't expect underTasksNode && inConfig");
                            }

                            // only add tasks under task node!  (if there is a task that only exists under a config, ignore it!)
                            if (underTasksNode)
                            {
                                string? text = r.GetString();
                                if(agentTasks.ContainsKey(text!))
                                {
                                    throw new Exception($"duplicate task in make-options {text}");
                                }

                                AgentTask task = new AgentTask(text!);
                                agentTasks.Add(text!, task);
                            }

                            if (inConfig)
                            {
                                string? text = r.GetString();

                                AgentTask? task;
                                if (agentTasks.TryGetValue(text!, out task))
                                {
                                    if (configName == "")
                                    {
                                        throw new Exception("expected configName to have value");
                                    }

                                    task.Configs.Add(configName);
                                }
                            }

                            break;
                        }
                    default:
                        //Console.WriteLine(r.TokenType);
                        break;
                }
            }

            // startarray, endarray

            return agentTasks;
        }


        internal class AgentTask
        {
            public AgentTask(string name)
            {
                Name = name;
            }

            public readonly string Name;

            public readonly HashSet<string> Configs = new HashSet<string>();

        }
    }
}
