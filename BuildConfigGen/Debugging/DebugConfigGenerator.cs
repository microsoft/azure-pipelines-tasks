namespace BuildConfigGen.Debugging
{
    internal interface IDebugConfigGenerator
    {
        void WriteTypescriptConfig(string taskOutput);

        void AddForTask(string taskConfigPath);

        void WriteLaunchConfigurations();
    }

    sealed internal class NoDebugConfigGenerator : IDebugConfigGenerator
    {
        public void AddForTask(string taskConfigPath)
        {
            // noop
        }

        public void WriteLaunchConfigurations()
        {
            // noop
        }

        public void WriteTypescriptConfig(string taskOutput)
        {
            throw new NotImplementedException();
        }
    }
}
