using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;

#nullable disable

class FactorialCalculator
{
    /*
    static void Main(string[] args)
    {
        //while (true)
        {
            try
            {

                Guid instance = Guid.NewGuid();
                try
                {
                    Console.WriteLine("Enter a number:");
                    int number = int.Parse(Console.ReadLine());
                    int factorial;
                    try
                    {
                        RuntimeTests.Instance(instance).Factorial_InputIsNegativeNumber_ThrowsArgumentException.PreconditionAreEqual(number, -1);
                        factorial = Factorial(number);
                    }
                    catch (ArgumentException ex)
                    {
                        RuntimeTests.Instance(instance).Factorial_InputIsNegativeNumber_ThrowsArgumentException.AssertExceptedException(typeof(ArgumentException), ex);
                        throw;
                    }

                    Console.WriteLine($"Factorial of {number} is {factorial}");
                }
                finally
                {
                    RuntimeTests.Instance(instance).Factorial_InputIsNegativeNumber_ThrowsArgumentException.Done();
                }
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
            }
            finally
            {
                RuntimeTests.Evaluate();
            }
        }
    }
    */

    /*
    public static int Factorial(int n)
    {
        Guid instance = Guid.NewGuid();
        int result = int.MinValue;

        RuntimeTests.Instance(instance).Factorial_InputIsZero_ReturnsOne.PreconditionAreEqual(n, 0);
        RuntimeTests.Instance(instance).Factorial_InputIsOne_ReturnsOne.PreconditionAreEqual(n, 1);
        RuntimeTests.Instance(instance).Factorial_InputIsPositiveNumber_ReturnsCorrectFactorial.PreconditionAreEqual(n, 5);

        try
        {
            return (result = Factorial_(n));
        }
        finally
        {
            RuntimeTests.Instance(instance).Factorial_InputIsZero_ReturnsOne.AssertAreEqual(1, result).Done();
            RuntimeTests.Instance(instance).Factorial_InputIsOne_ReturnsOne.AssertAreEqual(1, result).Done();
            RuntimeTests.Instance(instance).Factorial_InputIsPositiveNumber_ReturnsCorrectFactorial.AssertAreEqual(120, result).Done();
        }

    }


    public static int Factorial_(int n)
    {
        if (n < 0)
            throw new ArgumentException("Number must be non-negative.");

        if (n == 0 || n == 1)
        {
            return 1;
        }

        return n * Factorial(n - 1);
    }*/
}

class RuntimeTestsWithInstance
{
    object instance;
    private RuntimeTests runtimeTests;

    public RuntimeTestsWithInstance(object instance, RuntimeTests runtimeTests)
    {
        this.instance = instance;
        this.runtimeTests = runtimeTests;
    }

    public MyTest2Instance ResolveFile_EnsureRedirectedTempFileReturnedForFinalFile => RuntimeTest.Instance.Get(nameof(ResolveFile_EnsureRedirectedTempFileReturnedForFinalFile), instance);
    public MyTest2Instance ResolveFile_EnsureRedirectedTempFileOfFileWithCopyIsReturned => RuntimeTest.Instance.Get(nameof(ResolveFile_EnsureRedirectedTempFileOfFileWithCopyIsReturned), instance);
    public MyTest2Instance ResolveFile_EnsureNonTempFileReturnedForCopiedFileNotWrittenTo => RuntimeTest.Instance.Get(nameof(ResolveFile_EnsureNonTempFileReturnedForCopiedFileNotWrittenTo), instance);
    
}

class RuntimeTests
{
    private object syncObject = new Object();

    private static RuntimeTests runtimeTests = new RuntimeTests();

    public static RuntimeTestsWithInstance Instance(object instance)
    {
        return new RuntimeTestsWithInstance(instance, runtimeTests);
    }

    internal static void Evaluate()
    {
        RuntimeTest.Instance.Evaluate();
    }

    //public MyTest2Instance [] Tests => new MyTest2Instance []  {Factorial_InputIsZero_ReturnsOne,Factorial_InputIsOne_ReturnsOne, Factorial_InputIsPositiveNumber_ReturnsCorrectFactorial, Factorial_InputIsNegativeNumber_ThrowsArgumentException };

    /*
		public void Done()
		{
			lock (syncObject)
			{
				foreach (var t in Tests)
				{
					t.Done();
				}
			}
		}*/
}

class RuntimeTest
{
    object syncObject = new Object();

    public static RuntimeTest Instance = new RuntimeTest() { target = new RuntimeTestUnsafe() };

    RuntimeTestUnsafe target;

    public MyTest2Instance Get(string testName, object instance)
    {
        lock (syncObject)
        {
            return new MyTest2Instance(target.Do(testName, instance));
        }
    }

    public void Evaluate()
    {
        lock (syncObject)
        {
            target.Evaluate();
        }
    }
}

[DataContract]
class RuntimeTestUnsafe
{
    [DataMember]
    public Dictionary<object, MyTest2> d = new Dictionary<object, MyTest2>();

    [DataMember]
    public List<string> tests = new List<string>(new[] { "Factorial_InputIsZero_ReturnsOne", "Factorial_InputIsOne_ReturnsOne", "Factorial_InputIsPositiveNumber_ReturnsCorrectFactorial", "Factorial_InputIsNegativeNumber_ThrowsArgumentException" });

    private static bool loaded = false;

    public MyTest2InstanceUnsafe Do(string testName, object instance)
    {
        EnsureLoaded();

        MyTest2 ret;
        if (d.TryGetValue(testName, out ret))
        {
        }
        else
        {
            d.Add(testName, ret = new MyTest2(testName));
        }

        return ret.GetInstance(instance);
    }

    private void EnsureLoaded()
    {
        if (loaded)
        {
            return;
        }

        if (File.Exists(@"C:\Users\merlynop\Documents\out.txt"))
        {
            List<Type> knownTypes = new List<System.Type> { typeof(Dictionary<object, MyTest2>) };
            System.Runtime.Serialization.DataContractSerializer dcs = new DataContractSerializer(typeof(RuntimeTestUnsafe), new DataContractSerializerSettings
            {
                PreserveObjectReferences = true,
                KnownTypes = knownTypes
            });

            using (var fs = File.OpenRead(@"C:\Users\merlynop\Documents\out.txt"))
            {
                d = (Dictionary<object, MyTest2>)dcs.ReadObject(fs);
            }
        }

        loaded = true;
    }

    internal void Evaluate()
    {
        EnsureLoaded();

        //d.Select(d => new { d.Key, d.Value.Status.v, d.Value.FailureInfo }).Dump();

        Console.WriteLine("Key Status FailureInfo");

        foreach(var t in d)
        {
            Console.WriteLine($"{t.Key} {t.Value.Status.v} {t.Value.FailureInfo}");
        }

        using (MemoryStream memoryStream = new MemoryStream())
        {
            List<Type> knownTypes = new List<System.Type> { typeof(Dictionary<object, MyTest2>) };
            System.Runtime.Serialization.DataContractSerializer dcs = new DataContractSerializer(typeof(RuntimeTestUnsafe), new DataContractSerializerSettings
            {
                PreserveObjectReferences = true,
                KnownTypes = knownTypes
            });

            dcs.WriteObject(memoryStream, d);
            var outText = Encoding.UTF8.GetString(memoryStream.ToArray());
            File.WriteAllText(@"C:\Users\merlynop\Documents\out.txt", outText);
        }
    }
}

class MyTest2Instance
{
    private MyTest2InstanceUnsafe myTest2InstanceUnsafe;
    private object syncObject = new Object();

    public MyTest2Instance(MyTest2InstanceUnsafe myTest2InstanceUnsafe)
    {
        this.myTest2InstanceUnsafe = myTest2InstanceUnsafe;
    }

    internal MyTest2Instance AssertFailed()
    {
        lock (syncObject)
        {
            return new MyTest2Instance( this.myTest2InstanceUnsafe.AssertFailed());
        }
    }

    internal MyTest2Instance AssertPassed()
    {
        lock (syncObject)
        {
            return new MyTest2Instance(this.myTest2InstanceUnsafe.AssertPassed());
        }
    }

    internal void Done()
    {
        lock (syncObject)
        {
            this.myTest2InstanceUnsafe.Done();
        }
    }

    internal void NegativePrecondition()
    {
        lock (syncObject)
        {
            this.myTest2InstanceUnsafe.NegativePrecondition();
        }
    }

    internal void Precondition()
    {
        lock (syncObject)
        {
            this.myTest2InstanceUnsafe.Precondition();
        }
    }
}


[DataContract]
class TestStatus
{
    public static TestStatus NotStarted = new TestStatus("NotStarted");
    public static TestStatus Passed = new TestStatus("Passed");
    public static TestStatus Failed = new TestStatus("Failed");

    public static TestStatus Default = NotStarted;

    [DataMember]
    public string v;


    public TestStatus(string v)
    {
        this.v = v;
    }

    public override string ToString()
    {
        return v;
    }

    internal TestStatus GetFailed()
    {
        return Failed;
    }

    internal TestStatus GetPassed()
    {
        if (v == Failed.v)
        {
            return this;
        }

        return Passed;
    }
}

[DataContract]
class MyTest2
{
    [DataMember]
    public Dictionary<object, MyTest2InstanceUnsafe> d = new Dictionary<object, MyTest2InstanceUnsafe>();

    [DataMember]
    internal readonly string testName;

    [DataMember]
    public string FailureInfo;

    [DataMember]
    public TestStatus Status = TestStatus.Default;

    public MyTest2(string testName)
    {
        this.testName = testName;
    }

    public MyTest2InstanceUnsafe GetInstance(object instance)
    {
        MyTest2InstanceUnsafe ret;
        if (d.TryGetValue(instance, out ret))
        {
        }
        else
        {
            d.Add(instance, ret = new MyTest2InstanceUnsafe(instance, this));
        }

        return ret;
    }

    public void RemoveInstance(object instance)
    {
        d.Remove(instance);
    }
}

[DataContract]
class MyTest2InstanceUnsafe
{
    [DataMember]
    private readonly object instance;

    [DataMember]
    MyTest2 myTest2;

    [DataMember]
    bool preCondition = false;

    [DataMember]
    bool negativePreCondition = false;

    public MyTest2InstanceUnsafe(object instance, MyTest2 myTest2)
    {
        this.instance = instance;
        this.myTest2 = myTest2;
    }

    internal MyTest2InstanceUnsafe AssertPassed()
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} AssertPassed");

        if (!preCondition)
        {
            return this;
        }

        if (negativePreCondition)
        {
            return this;
        }

        myTest2.Status = myTest2.Status.GetPassed();

        return this;
    }


    internal MyTest2InstanceUnsafe AssertFailed()
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} AssertFailed");

        if (!preCondition)
        {
            return this;
        }

        if (negativePreCondition)
        {
            return this;
        }

        myTest2.Status = myTest2.Status.GetFailed();
        var st = new StackTrace(true);
        myTest2.FailureInfo = $@"Failed " + st.ToString();

        return this;
    }


    internal MyTest2InstanceUnsafe AssertAreEqual(int expected, int actual)
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} AssertAreEqual n={expected} v={actual}");

        if (!preCondition)
        {
            return this;
        }

        if (negativePreCondition)
        {
            return this;
        }

        if (expected == actual)
        {
            myTest2.Status = myTest2.Status.GetPassed();
        }
        else
        {
            myTest2.Status = myTest2.Status.GetFailed();
            var st = new StackTrace(true);
            myTest2.FailureInfo = $@"Expected ""{expected}"" Got ""{actual}"" " + st.ToString();
        }

        return this;
    }

    internal MyTest2InstanceUnsafe AssertExceptedException(Type exception, Exception ex)
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} AssertExceptedException n={exception} v={ex.GetType()}");

        if (!preCondition)
        {
            return this;
        }

        if (negativePreCondition)
        {
            return this;
        }

        if (ex.GetType() == exception)
        {
            myTest2.Status = myTest2.Status.GetPassed();
        }
        else
        {
            myTest2.Status = myTest2.Status.GetFailed();
            var st = new StackTrace(true);
            myTest2.FailureInfo = $@"Expected ""{exception}"" Got ""{ex.GetType()}"" " + st.ToString();
        }

        return this;
    }

    // If conditions match, then precondtions for the test are matched, and test will be skipped
    internal void PreconditionAreEqual(int n, int v)
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} PreconditionAreEqual n={n} v={v}");

        if (n == v)
        {
            preCondition = true;
        }
    }

    internal void Precondition()
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} Precondition");
        preCondition = true;
    }

    internal void Done()
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} Done preCondition={preCondition} negativePreCondition={negativePreCondition} status={myTest2.Status.v}");

        if (!negativePreCondition && preCondition && !(myTest2.Status == TestStatus.Passed))
        {
            myTest2.Status = myTest2.Status.GetFailed();
            var st = new StackTrace(true);
            if (myTest2.FailureInfo == null)
            {
                myTest2.FailureInfo = "Precondition met, but Assert not executed";
            }
        }

        preCondition = false;
        negativePreCondition = false;

        myTest2.RemoveInstance(instance);
    }


    internal void NegativePrecondition()
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} NegativePrecondition");
        negativePreCondition = true;
    }

    // If conditions match, then precondtions for the test are considered not matched, and test will be skipped
    internal void NegativePreconditionAreEqual(int v1, int v2)
    {
        Console.WriteLine($"RuntimeTests: {myTest2.testName} {instance} NegativePreconditionAreEqual v1={v1} v2={v2}");

        if (v1 == v2)
        {
            negativePreCondition = true;
        }
    }
}