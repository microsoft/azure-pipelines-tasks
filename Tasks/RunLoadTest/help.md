#Cloud-based Load Test with Visual Studio Online

Cloud-based Load Test task can be used to trigger a load test on the Visual Studio Online Cloud-based Load Test Service.

The Cloud-based Load Test Service can be used for performance and load testing of your application by generating load from Azure. If you are new to Cloud-based Load Testing then following links will help you:

* [Cloud-based Load Test with Visual Studio Online](https://www.visualstudio.com/features/vso-cloud-load-testing-vs)
* Introduction to Cloud-based Load Testing with VSO ([video](http://channel9.msdn.com/Events/Visual-Studio/Launch-2013/qe103))


To be successful with this task, you should have already created a load test project with Visual Studio Ultimate with the required web performance tests ([Get Started](https://www.visualstudio.com/get-started/load-test-your-app-vs)) and configured the load test appropriately. This task simply takes an already created load test as input and executes it via the Service.

To use this task, you need to supply the folder path to the Load Test directory within your build output where all the load test files including any setup and clean scripts ([learn more](http://blogs.msdn.com/b/visualstudioalm/archive/2015/01/12/using-setup-and-cleanup-script-in-cloud-load-test.aspx)) would be present. This would be where this task looks for the load test file and test settings file. You also have to specify the name of the load test file (xyz.loadtest) and the test settings file (abc.testsettings) that you want executed. Once these are provided, the task will have all the data to trigger a load test.

Optionally, if your load test is already setup with threshold violations ([learn more about threshold violations](https://msdn.microsoft.com/en-us/library/ff426917.aspx)), then you can specify the number of critical violations to wait for before the load test should be deemed unsuccessful, in which case, the load test would then be aborted and the load test task would be marked as failed.

[Additional resources on Cloud-based Load Testing with VSO](http://aka.ms/loadtestkb)

If you have feedback for us, please log them [here](http://visualstudio.uservoice.com/forums/121579-visual-studio/).
