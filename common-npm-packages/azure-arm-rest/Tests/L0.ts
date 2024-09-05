import { AzureAppServiceMockTests } from "./L0-azure-arm-app-service";
import { KuduServiceTests } from "./L0-azure-arm-app-service-kudu-tests";
import { ApplicationInsightsTests } from "./L0-azure-arm-appinsights-tests";
import { ApplicationInsightsTests as ApplicationInsightsTestsWebTests } from "./L0-azure-arm-appinsights-webtests-tests";
import { ResourcesTests } from "./L0-azure-arm-resource-tests";
const DEFAULT_TIMEOUT = 1000 * 20;

describe("AzureARMRestTests", function () {
    describe("KuduService tests", KuduServiceTests.bind(KuduServiceTests, DEFAULT_TIMEOUT));
    describe("AzureAppServiceMock tests", AzureAppServiceMockTests.bind(AzureAppServiceMockTests, DEFAULT_TIMEOUT));
    describe("ApplicationInsights tests", ApplicationInsightsTests.bind(ApplicationInsightsTests, DEFAULT_TIMEOUT))
    describe("ApplicationInsightsTests", ApplicationInsightsTests.bind(ApplicationInsightsTests, DEFAULT_TIMEOUT))
    describe("ApplicationInsightsWeb tests", ApplicationInsightsTestsWebTests.bind(ApplicationInsightsTestsWebTests, DEFAULT_TIMEOUT))
    describe("Resources Tests", ResourcesTests.bind(ResourcesTests, DEFAULT_TIMEOUT));
});