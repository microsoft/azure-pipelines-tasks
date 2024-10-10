import { runGetMSDeployCmdArgsTests, runGetWebDeployErrorCodeTests } from './L0MSDeployUtility';
import { runCopyDirectoryTests } from "./L0CopyDirectory";
import { runGenerateWebCongigTests } from "./L0GenerateWebConfig";
import { runL1XmlVarSubTests } from "./L1XmlVarSub";
import { runL1XdtTransformTests } from "./L1XdtTransform"
import { runL1JSONVarSubWithCommentsTests } from "./L1JSONVarSubWithComments";
import { runL1JsonVarSubTests } from "./L1JsonVarSub";
import { runL1JsonVarSubV2Tests } from "./L1JsonVarSubV2";
import { runL1ValidateFileEncodingTests } from "./L1ValidateFileEncoding";
import { runParameterParserUtilityTests } from "./L0ParameterParserUtility";
import { runL1ZipUtilityTests } from "./L1ZipUtility";

describe('Web deployment common tests', () => {
    describe('GetMSDeployCmdArgs tests', runGetMSDeployCmdArgsTests);
    describe('GetWebDeployErrorCode tests', runGetWebDeployErrorCodeTests);
    describe("CopyDirectory tests", runCopyDirectoryTests);
    describe("GenerateWebConfig tests", runGenerateWebCongigTests);
    describe("L1XmlVarSub tests", runL1XmlVarSubTests);
    describe("L1XdtTransform tests", runL1XdtTransformTests);
    describe("L1JSONVarSubWithComments tests", runL1JSONVarSubWithCommentsTests);
    describe("L1JsonVarSub tests", runL1JsonVarSubTests);
    describe("L1JsonVarSubV2 tests", runL1JsonVarSubV2Tests);
    describe("L1ValidateFileEncoding tests", runL1ValidateFileEncodingTests);
    describe("ParameterParserUtility tests", runParameterParserUtilityTests);
    describe("ZipUtility tests", runL1ZipUtilityTests);
});