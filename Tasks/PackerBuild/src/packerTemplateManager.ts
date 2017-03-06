// "use strict";

// import * as os from "os";
// import * as path from "path";
// import * as tl from "vsts-task-lib/task";
// import * as utils from "./utilities"
// import * as constants from "./constants"
// import * as definitions from "./definitions"

// export default class PackerTemplateManager {

//     constructor() {
//         this._templateFileProviders = {};
//         this._templateVariablesProviders = {};
//     }

//     public registerTemplateFileProvider(providerType: definitions.TemplateFileProviderTypes, provider: definitions.ITemplateFileProvider) {
//         this._templateFileProviders[providerType] = provider;
//     }

//     public registerTemplateVariablesProvider(providerType: definitions.VariablesProviderTypes, provider: definitions.ITemplateVariablesProvider) {
//         this._templateVariablesProviders[providerType] = provider;
//     }

//     public getTemplateFileLocation(): string {
//         if(!!this._templateFileLocation) {
//             return this._templateFileLocation;
//         }

//         // get template file location from suitable provider
//         var osType = tl.getInput(constants.OsTypeInputName);
//         var templateProvider = this._templateFileProviders[definitions.TemplateFileProviderTypes.BuiltIn];
//         var templateFileLocation = templateProvider.getTemplateFileLocation(osType);
//         console.log(tl.loc("OriginalTemplateLocation", templateFileLocation));

//         // move file to a temp folder - this is a cautionary approach so that previous packer execution which still has handle on template does not cause any problem
//         var tempLocationForTemplate = path.join(utils.getTempDirectory(), utils.getCurrentTime().toString())
//         console.log(tl.loc("CopyingTemplate", templateFileLocation, tempLocationForTemplate));
//         utils.copyFile(templateFileLocation, tempLocationForTemplate);
//         console.log(tl.loc("TempTemplateLocation", tempLocationForTemplate));      
        
//         // construct new full path for template file
//         var templateFileName = path.basename(templateFileLocation);
//         var tempFileLocation = path.join(tempLocationForTemplate, templateFileName);
//         this._templateFileLocation = tempFileLocation;
//         tl.debug("template location: " + tempFileLocation);

//         return tempFileLocation; 
//     }

//     public getTemplateVariables(): Map<string, string> {
//         if(!!this._templateVariables) {
//             return this._templateVariables;
//         }

//         var osType = tl.getInput(constants.OsTypeInputName);
//         this._templateVariables = new Map<string, string>();
        
//         var inputVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.TaskInput];
//         var inputVariables = inputVariablesProvider.getTemplateVariables(osType);
//         inputVariables.forEach((value: string, key: string) => this._templateVariables.set(key, value));

//         var azureSPNVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.AzureSPN];
//         var spnVariables = azureSPNVariablesProvider.getTemplateVariables(osType);
//         spnVariables.forEach((value: string, key: string) => this._templateVariables.set(key, value));
        
//         return this._templateVariables;
//     }

//     private _templateFileProviders: ObjectDictionary<definitions.ITemplateFileProvider>;
//     private _templateFileLocation: string;
//     private _templateVariablesProviders: ObjectDictionary<definitions.ITemplateVariablesProvider>;
//     private _templateVariables: Map<string, string>;
// }

// interface ObjectDictionary<T> { [key: number]: T; }