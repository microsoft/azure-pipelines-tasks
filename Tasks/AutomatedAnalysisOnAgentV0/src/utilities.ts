import tl = require('azure-pipelines-task-lib/task');

function setProviderVariables() {
    var metricsProvider = tl.getInput("provider", true);
    tl.setVariable('METRICS_PROVIDER', metricsProvider);
    if (metricsProvider == "Prometheus")
    {
        var endpointUrl = tl.getInput("endpointUrl", true); 
        var headers = tl.getInput("headers")
        tl.setVariable('ENDPOINT', endpointUrl);
        tl.setVariable('HEADERS', headers);
    }
    else if (metricsProvider == "Datadog")
    {
        var apiKey = tl.getInput("apiKey", true);
        var appKey = tl.getInput("appKey", true);
        var headers = tl.getInput("headers")
        tl.setVariable('API_KEY', apiKey, true);
        tl.setVariable('APP_KEY', appKey, true);
        tl.setVariable('HEADERS', headers);
    }
}

function setMetricVariables() {
    var exprTemplates = tl.getInput('expressionTemplates', true);
    var templateSubstitutions = tl.getInput('templateSubstitutions', true);
    var areMetricsCritical = tl.getInput('areMetricsCritical', false);
    var mustHaveData = tl.getInput('mustHaveData', false);
    tl.setVariable('EXPRESSION_TEMPLATES', exprTemplates);
    tl.setVariable('TEMPLATE_SUBSTITUTIONS', templateSubstitutions);
    tl.setVariable('ARE_METRICS_CRITICAL', areMetricsCritical);
    tl.setVariable('MUST_HAVE_DATA', mustHaveData);
}

function setOrchestrationVariables() {
    var analysisType = tl.getInput('analysisType', true);
    var windowType = tl.getInput('windowType', true);
    var delay = tl.getInput('delay', false);
    var lifetime = tl.getInput('lifetime', false);
    var interval = tl.getInput('interval', false);
    var step = tl.getInput('step', false);

    tl.setVariable('ANALYSIS_TYPE', analysisType);
    tl.setVariable('WINDOW_TYPE', windowType);
    tl.setVariable('DELAY', delay);
    tl.setVariable('LIFETIME', lifetime);
    tl.setVariable('INTERVAL', interval);
    tl.setVariable('STEP', step);

    if (analysisType == "range")
    {
        var analysisBeginTime = tl.getInput('analysisBeginTime', true);
        var analysisEndTime = tl.getInput('analysisEndTime', true);
        tl.setVariable('ANALYSIS_BEGIN_TIME', analysisBeginTime);
        tl.setVariable('ANALYSIS_END_TIME', analysisEndTime);
    }
}

function setPreprocessorVariables() {
    var preprocessor = tl.getInput('preprocessor', true);
    var nanStrategy = tl.getInput('nanStrategy', false);
    tl.setVariable('PREPROCESSOR', preprocessor);
    tl.setVariable('NAN_STRATEGY', nanStrategy);
}

function setClassifierVariables() {
    var classifier = tl.getInput('classifier', true);
    var metricGroups = tl.getInput('metricGroups', false);
    var groupWeights = tl.getInput('groupWeights', false);
    var direction = tl.getInput('direction', false);
    var confidenceLevel = tl.getInput('confidenceLevel', false);
    var allowedIncrease = tl.getInput('allowedIncrease', false);
    var allowedDecrease = tl.getInput('allowedDecrease', false);
    var criticalIncrease = tl.getInput('criticalIncrease', false);
    var criticalDecrease = tl.getInput('criticalDecrease', false);
    tl.setVariable('CLASSIFIER', classifier);
    tl.setVariable('METRIC_GROUPS', metricGroups);
    tl.setVariable('GROUP_WEIGHTS', groupWeights);
    tl.setVariable('DIRECTION', direction);
    tl.setVariable('CONFIDENCE_LEVEL', confidenceLevel);
    tl.setVariable('ALLOWED_INCREASE', allowedIncrease);
    tl.setVariable('ALLOWED_DECREASE', allowedDecrease);
    tl.setVariable('CRITICAL_INCREASE', criticalIncrease);
    tl.setVariable('CRITICAL_DECREASE', criticalDecrease);
}

function setScoringVariables() {
    var marginalThreshold = tl.getInput('marginalThreshold', false);
    var passThreshold = tl.getInput('passThreshold', false);
    tl.setVariable('MARGINAL_THRESHOLD', marginalThreshold);
    tl.setVariable('PASS_THRESHOLD', passThreshold);

}

export function setAnalysisVariables() {
    var logLevel = tl.getInput('logLevel', false);
    tl.setVariable('LOG_LEVEL', logLevel);
    setProviderVariables();
    setMetricVariables();
    setOrchestrationVariables();
    setPreprocessorVariables();
    setClassifierVariables();
    setScoringVariables();
}