using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BuildConfigGen
{
    internal static class ProcessUtil
    {
        public static int RunCommandWithExitCode(string program, string args, string workingDir, out string[] output)
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
}
