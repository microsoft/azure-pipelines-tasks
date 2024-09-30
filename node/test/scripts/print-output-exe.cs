using System;
namespace PrintOutput
{
    public static class Program
    {
        public static Int32 Main(String[] args)
        {
            // Validate at least two args
            if (args.Length < 2)
            {
                throw new Exception("Expected arguments EXIT_CODE VALUE [...VALUE]");
            }

            // Validate exit code arg
            Int32 code;
            if (!Int32.TryParse(args[0] ?? String.Empty, out code))
            {
                throw new Exception("Expected EXIT_CODE to be an integer");
            }

            // Validate value args
            for (Int32 i = 1 ; i < args.Length ; i++)
            {
                if (String.IsNullOrEmpty(args[i]))
                {
                    throw new Exception("Expected VALUE to not be empty");
                }
            }

            // Write values
            for (Int32 i = 1 ; i < args.Length ; i++)
            {
                Console.WriteLine(args[i]);
            }

            return code;
        }
    }
}
