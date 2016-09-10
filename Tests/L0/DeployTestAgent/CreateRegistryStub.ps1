# Stub Registry Object
Add-Type -Language CSharp @"
public class Registry
    {
        public string PSChildName;
        public string[] SubKeyNames;
        public string[] GetSubKeyNames()
        {
            return SubKeyNames;
        }

        public string GetValue(string property){
            return "fake";
        }
    }

public class AgentProps
    {
        public string GetValue(string property){
            return "fake";
        }
    }
"@;