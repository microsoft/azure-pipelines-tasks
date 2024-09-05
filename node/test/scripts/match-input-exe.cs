using System;
namespace MatchInput
{
    public static class Program
    {
        public static Int32 Main(String[] args)
        {
            // Validate at least two args
            if (args.Length < 2)
            {
                throw new Exception("Expected arguments EXIT_CODE MATCH_VALUE [ERROR]");
            }

            // Validate exit code arg
            Int32 code;
            if (!Int32.TryParse(args[0] ?? String.Empty, out code))
            {
                throw new Exception("Expected EXIT_CODE to be an integer");
            }

            // Validate match value arg
            String match = args[1];
            if (String.IsNullOrEmpty(match))
            {
                throw new Exception("Expected MATCH_VALUE to not be empty");
            }

            // Optional error message arg
            String error = args.Length >= 3 ? args[2] : null;

            String line;
            while (true)
            {
                // Read STDIN
                line = Console.ReadLine();

                // Null indicates end of stream
                if (line == null)
                {
                    break;
                }

                // Print matches
                if (line.IndexOf(match) >= 0)
                {
                    Console.WriteLine(line);
                }
            }

            // Print optional error message
            if (!String.IsNullOrEmpty(error))
            {
                Console.Error.WriteLine(error);
            }

            return code;
        }
    }
}
