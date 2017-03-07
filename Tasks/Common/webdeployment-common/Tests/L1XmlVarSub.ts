var xmlSubstitutionUtility = require('webdeployment-common/xmlvariablesubstitutionutility.js');
var path = require('path');

async function xmlVarSub() {
    var tags = ["applicationSettings", "appSettings", "connectionStrings", "configSections"];
    var configFiles = [path.join(__dirname, 'L1XmlVarSub/Web_test.config'), path.join(__dirname, 'L1XmlVarSub/Web_test.Debug.config')];
    var variableMap = {
        'conntype' : 'new_connType',
        "MyDB": "TestDB",
        'webpages:Version' : '1.1.7.3',
        'xdt:Transform' : 'DelAttributes',
        'xdt:Locator' : 'Match(tag)',
        'DefaultConnection': 'connectionStringValue1',
        'OtherDefaultConnection': 'connectionStringValue2',
        'ParameterConnection': 'New_Connection_String From xml var subs',
        'connectionString': 'replaced_value'
    }

    var parameterFilePath = path.join(__dirname, 'L1XmlVarSub/parameters_test.xml');
    for(var configFile of configFiles) {
        await xmlSubstitutionUtility.substituteXmlVariables(configFile, tags, variableMap, parameterFilePath);
    }
}

xmlVarSub();