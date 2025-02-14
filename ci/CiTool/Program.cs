using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

internal class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("No arguments provided.");
            return 1;
        }

        string command = args[0];
        string[] commandArgs = args.Skip(1).ToArray();

        switch (command.ToLower())
        {
            case "filtertasks":
                await FilterTasksUtil.LocalMain(commandArgs);
                break;
            case "checkdowngrading":
                await CheckDowngrading.LocalMain(commandArgs);
                break;
            default:
                return 1;
        }

        return 0;
    }
}
