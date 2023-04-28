import * as assert from'assert';
import * as path from'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { Done } from 'mocha';

describe('AzureContainerAppsV0 Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner, done: Done) {
        try {
            validator();
            done();
        } catch (error) {
            console.log('STDERR', tr.stderr);
            console.log('STDOUT', tr.stdout);
            done(error);
        }
    }

    it('Fails for missing required arguments.', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0FailsForMissingRequiredArguments.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task failed
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when none of the required arguments are provided.');

            // Validate the correct error message was thrown
            assert(tr.stdout.includes('MissingRequiredArgumentMessage'), 'AzureContainerAppsV0 task should have failed when none of the required arguments are provided.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setFailedResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task failed.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Fails for appSourcePath provided without acrName', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0FailsForAppSourcePathWithoutAcrName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task failed
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when appSourcePath is provided without acrName.');

            // Validate the correct error message was thrown
            assert(tr.stdout.includes('MissingAcrNameMessage'), 'AzureContainerAppsV0 task should have failed when appSourcePath is provided without acrName.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setFailedResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task failed.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Fails for no service connection argument', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0FailsForNoServiceConnectionArgument.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task failed
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when no service connection argument is provided.');

            // Validate the correct error message was thrown
            assert(tr.stdout.includes('Input required: connectedServiceNameARM'), 'AzureContainerAppsV0 task should have failed when no service connection argument is provided.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setFailedResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task failed.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with the Oryx++ builder', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithBuilder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App using an image produced from the Oryx++ builder.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');

            // Validate authentication against ACR
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');
            assert(tr.stdout.includes('[MOCK] loginAcrWithAccessTokenAsync called'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');

            // Validate image details were properly determined
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should generate the name of the image to build if not provided.');
            assert(tr.stdout.includes('DefaultImageToDeployMessage'), 'AzureContainerAppsV0 task should generate the name of the image to deploy if not provided.');

            // Validate that the image was built and pushed
            assert(tr.stdout.includes('CheckForAppSourceDockerfileMessage'), 'AzureContainerAppsV0 task should check for a Dockerfile with application source is provided and no Dockerfile is provided.');
            assert(tr.stdout.includes('[MOCK] installPackCliAsync called'), 'AzureContainerAppsV0 task should install the pack CLI with the build scenario.');
            assert(tr.stdout.includes('[MOCK] determineRuntimeStackAsync called'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('DefaultRuntimeStackMessage'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('CreateImageWithBuilderMessage'), 'AzureContainerAppsV0 task should use the Oryx++ builder to produce a runnable application image based on the provided application source.');
            assert(tr.stdout.includes('[MOCK] setDefaultBuilder called'), 'AzureContainerAppsV0 task should set the Oryx++ builder as the default builder with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] createRunnableAppImage called'), 'AzureContainerAppsV0 task should create a runnable application image with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] setBuilderScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the builder scenario was used.');
            assert(tr.stdout.includes('[MOCK] pushImageToAcr called'), 'AzureContainerAppsV0 task should push the runnable application image to ACR with the builder scenario.');

            // Validate that command line arguments were set correctly
            assert(tr.stdout.includes('DefaultIngressMessage'), 'AzureContainerAppsV0 task should use a default ingress value if not provided during the create scenario.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should use a default target port value if not provided during the create scenario.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerApp called'), 'AzureContainerAppsV0 task should create a Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with a Dockerfile', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithDockerfile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App using an image produced from a Dockerfile.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');

            // Validate authentication against ACR
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');
            assert(tr.stdout.includes('[MOCK] loginAcrWithAccessTokenAsync called'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');

            // Validate image details were properly determined
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should generate the name of the image to build if not provided.');
            assert(tr.stdout.includes('DefaultImageToDeployMessage'), 'AzureContainerAppsV0 task should generate the name of the image to deploy if not provided.');

            // Validate that the image was built and pushed
            assert(tr.stdout.includes('CreateImageWithDockerfileMessage'), 'AzureContainerAppsV0 task should build a runnable application image from a Dockerfile if provided.');
            assert(tr.stdout.includes('[MOCK] createRunnableAppImageFromDockerfile called'), 'AzureContainerAppsV0 task should build a runnable application image from a Dockerfile if provided.');
            assert(tr.stdout.includes('[MOCK] setDockerfileScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the Dockerfile scenario was used.');
            assert(tr.stdout.includes('[MOCK] pushImageToAcr called'), 'AzureContainerAppsV0 task should push the runnable application image to ACR with the builder scenario.');

            // Validate that command line arguments were set correctly
            assert(tr.stdout.includes('DefaultIngressMessage'), 'AzureContainerAppsV0 task should use a default ingress value if not provided during the create scenario.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should use a default target port value if not provided during the create scenario.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerApp called'), 'AzureContainerAppsV0 task should create a Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with a previously built image', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithImage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App using an image produced from a previously built image.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');

            // Validate that the image scenario was targeted
            assert(tr.stdout.includes('[MOCK] setImageScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the previously built image scenario was used.');

            // Validate that command line arguments were set correctly
            assert(tr.stdout.includes('DefaultIngressMessage'), 'AzureContainerAppsV0 task should use a default ingress value if not provided during the create scenario.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should use a default target port value if not provided during the create scenario.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerApp called'), 'AzureContainerAppsV0 task should create a Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with a new Container App environment', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithNewEnvironment.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App with a new Container App environment.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] getExistingContainerAppEnvironment called'), 'AzureContainerAppsV0 task should try to get an existing Container App environment if one was not provided.');
            assert(tr.stdout.includes('DefaultContainerAppEnvironmentMessage'), 'AzureContainerAppsV0 task should generate the Container App environment name if not provided or discovered.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');
            assert(tr.stdout.includes('[MOCK] createContainerAppEnvironment called'), 'AzureContainerAppsV0 task should create the Container App environment if it does not exist.');

            // Validate that the image scenario was targeted
            assert(tr.stdout.includes('[MOCK] setImageScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the previously built image scenario was used.');

            // Validate that command line arguments were set correctly
            assert(tr.stdout.includes('DefaultIngressMessage'), 'AzureContainerAppsV0 task should use a default ingress value if not provided during the create scenario.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should use a default target port value if not provided during the create scenario.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerApp called'), 'AzureContainerAppsV0 task should create a Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with a YAML configuration file and an image produced from the Oryx++ builder', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithYamlAndBuilder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App using a YAML configuration file and an image produced from the Oryx++ builder.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');

            // Validate authentication against ACR
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');
            assert(tr.stdout.includes('[MOCK] loginAcrWithAccessTokenAsync called'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');

            // Validate image details were properly determined
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should generate the name of the image to build if not provided.');
            assert(tr.stdout.includes('DefaultImageToDeployMessage'), 'AzureContainerAppsV0 task should generate the name of the image to deploy if not provided.');

            // Validate that the image was built and pushed
            assert(tr.stdout.includes('CheckForAppSourceDockerfileMessage'), 'AzureContainerAppsV0 task should check for a Dockerfile with application source is provided and no Dockerfile is provided.');
            assert(tr.stdout.includes('[MOCK] installPackCliAsync called'), 'AzureContainerAppsV0 task should install the pack CLI with the build scenario.');
            assert(tr.stdout.includes('[MOCK] determineRuntimeStackAsync called'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('DefaultRuntimeStackMessage'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('CreateImageWithBuilderMessage'), 'AzureContainerAppsV0 task should use the Oryx++ builder to produce a runnable application image based on the provided application source.');
            assert(tr.stdout.includes('[MOCK] setDefaultBuilder called'), 'AzureContainerAppsV0 task should set the Oryx++ builder as the default builder with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] createRunnableAppImage called'), 'AzureContainerAppsV0 task should create a runnable application image with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] setBuilderScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the builder scenario was used.');
            assert(tr.stdout.includes('[MOCK] pushImageToAcr called'), 'AzureContainerAppsV0 task should push the runnable application image to ACR with the builder scenario.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerAppFromYaml called'), 'AzureContainerAppsV0 task should create a Container App from the YAML configuration file if provided.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for creating a Container App with a YAML configuration file and a previously built image', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForCreateWithYamlAndImage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when creating a Container App using a YAML configuration file and a previously built image.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources were created
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should generate the Container App name if not provided.');
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should generate the resource group name if not provided.');
            assert(tr.stdout.includes('[MOCK] doesResourceGroupExist called'), 'AzureContainerAppsV0 task should check if the resource group exists.');
            assert(tr.stdout.includes('[MOCK] createResourceGroup called'), 'AzureContainerAppsV0 task should create the resource group if it does not exist.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppEnvironmentExist called'), 'AzureContainerAppsV0 task should check if the Container App environment exists.');

            // Validate that the image scenario was targeted
            assert(tr.stdout.includes('[MOCK] setImageScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the previously built image scenario was used.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] createContainerAppFromYaml called'), 'AzureContainerAppsV0 task should create a Container App from a YAML configuration file.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for updating a Container App with the Oryx++ builder', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForUpdateWithBuilder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when updating an existing Container App using an image produced from the Oryx++ builder.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources exist
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');

            // Validate authentication against ACR
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');
            assert(tr.stdout.includes('[MOCK] loginAcrWithAccessTokenAsync called'), 'AzureContainerAppsV0 task should authenticate with a generated access token if credentials are not provided.');

            // Validate image details were properly determined
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should generate the name of the image to build if not provided.');
            assert(tr.stdout.includes('DefaultImageToDeployMessage'), 'AzureContainerAppsV0 task should generate the name of the image to deploy if not provided.');

            // Validate that the image was built and pushed
            assert(tr.stdout.includes('CheckForAppSourceDockerfileMessage'), 'AzureContainerAppsV0 task should check for a Dockerfile with application source is provided and no Dockerfile is provided.');
            assert(tr.stdout.includes('[MOCK] installPackCliAsync called'), 'AzureContainerAppsV0 task should install the pack CLI with the build scenario.');
            assert(tr.stdout.includes('[MOCK] determineRuntimeStackAsync called'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('DefaultRuntimeStackMessage'), 'AzureContainerAppsV0 task should determine runtime stack to use if not provided with the builder scenario.');
            assert(tr.stdout.includes('CreateImageWithBuilderMessage'), 'AzureContainerAppsV0 task should use the Oryx++ builder to produce a runnable application image based on the provided application source.');
            assert(tr.stdout.includes('[MOCK] setDefaultBuilder called'), 'AzureContainerAppsV0 task should set the Oryx++ builder as the default builder with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] createRunnableAppImage called'), 'AzureContainerAppsV0 task should create a runnable application image with the builder scenario.');
            assert(tr.stdout.includes('[MOCK] setBuilderScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the builder scenario was used.');
            assert(tr.stdout.includes('[MOCK] pushImageToAcr called'), 'AzureContainerAppsV0 task should push the runnable application image to ACR with the builder scenario.');

            // Validate that the Container App was updated
            assert(tr.stdout.includes('[MOCK] updateContainerApp called'), 'AzureContainerAppsV0 task should update an existing Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for updating a Container App with a previously built image', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForUpdateWithImage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when updating an existing Container App using an image produced from a previously built image.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources exist
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');

            // Validate that the image scenario was targeted
            assert(tr.stdout.includes('[MOCK] setImageScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the previously built image scenario was used.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] updateContainerApp called'), 'AzureContainerAppsV0 task should update an existing Container App.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });

    it('Succeeds for updating a Container App with a YAML configuration file and a previously built image', (done: Done) => {
        this.timeout(5000);

        const tp: string = path.join(__dirname, 'L0SucceedsForUpdateWithYamlAndImage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            // Validate the task succeeded
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when updating an existing Container App using a YAML configuration file and a previously built image.');

            // Validate that the Azure CLI was set up correctly
            assert(tr.stdout.includes('[MOCK] loginAzureRM called'), 'AzureContainerAppsV0 task should authenticate with the provided service connection.');
            assert(tr.stdout.includes('[MOCK] setAzureCliDynamicInstall called'), 'AzureContainerAppsV0 task should have called ensure dynamic installation is enabled for the Azure CLI.');

            // Validate that the necessary Azure resources exist
            assert(tr.stdout.includes('[MOCK] getDefaultContainerAppLocation called'), 'AzureContainerAppsV0 task should determine the default location for the Container App if not provided.');
            assert(tr.stdout.includes('[MOCK] doesContainerAppExist called'), 'AzureContainerAppsV0 task should check if the Container App exists.');

            // Validate that the image scenario was targeted
            assert(tr.stdout.includes('[MOCK] setImageScenario called'), 'AzureContainerAppsV0 task should signal to telemetry that the previously built image scenario was used.');

            // Validate that the Container App was created
            assert(tr.stdout.includes('[MOCK] updateContainerAppFromYaml called'), 'AzureContainerAppsV0 task should update an existing Container App from a YAML configuration file.');

            // Validate the correct result was logged to telemetry
            assert(tr.stdout.includes('[MOCK] setSuccessfulResult called'), 'AzureContainerAppsV0 task should signal to telemetry that the task succeeded.');

            // Validate that the end-of-test scenarios are hit
            assert(tr.stdout.includes('[MOCK] logoutAzure called'), 'AzureContainerAppsV0 task should try to logout of Azure at the end of the task.');
            assert(tr.stdout.includes('[MOCK] sendLogs called'), 'AzureContainerAppsV0 task should send telemetry logs at the end of the task.');
        }, tr, done);
    });
});