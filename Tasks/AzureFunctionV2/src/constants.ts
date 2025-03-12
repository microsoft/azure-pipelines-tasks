export enum AuthType {
    Key = 'KeyAuthentication',
    ARM = 'ARMAuthentication'
}

export enum HttpMethod {
    OPTIONS = 'OPTIONS',
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    TRACE = 'TRACE',
    PATCH = 'PATCH'
}

export enum CompletionEvent {
    Callback = 'true',
    ApiResponse = 'false'
}

// Input names from task.json
export enum InputNames {
    AuthType = 'authenticationOptionSelector',
    ServiceConnection = 'ARMAuthentication',
    FunctionUrl = 'function',
    FunctionKey = 'key',
    Method = 'method',
    Headers = 'headers',
    QueryParams = 'queryParameters',
    Body = 'body',
    WaitForCompletion = 'waitForCompletion',
    SuccessCriteria = 'successCriteria'
};