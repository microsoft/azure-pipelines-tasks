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
                            }
                            else if (text == "tasks")
                            {
                                inConfig = false;
                            }
                            else
                            {

                                inConfig = true;
                                configName = text!;
                            }

                            break;
                        }
                    case JsonTokenType.String:
                        {
                            if (inConfig)
                            {
                                string? text = r.GetString();
                                //Console.WriteLine(r.TokenType + " " + text);

                                AgentTask task;
                                if (agentTasks.TryGetValue(text!, out task!))
                                {

                                }
                                else
                                {
                                    task = new AgentTask(text!);
                                    agentTasks.Add(text!, task);
                                }

                                if (configName == "")
                                {
                                    throw new Exception("expected configName to have value");
                                }

                                task.Configs.Add(configName);
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

            public string Name;

            public HashSet<string> Configs = new HashSet<string>();

        }
    }
}
