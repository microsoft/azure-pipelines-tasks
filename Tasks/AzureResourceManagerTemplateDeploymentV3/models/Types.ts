export interface ParameterValue {
    value?: any;
    reference?: any;
    type?: string;
}

export interface TemplateObject {
    $schema: string;
    contentVersion: string;
    outputs: Map<string, any>;
    parameters: Map<string, ParameterValue>;
    resources: Map<string, any>[];
    variables: Map<string, any>;
}