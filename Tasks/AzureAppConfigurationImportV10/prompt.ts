export const RISK_ANALYSIS_PROMPT = `You are a senior DevOps engineer performing a risk analysis on Azure App Configuration changes.
Analyze the following configuration diff and provide a comprehensive risk assessment.

Your response MUST be valid JSON with the following structure:
{
    "overallRiskLevel": "Low" | "Medium" | "High",
    "summary": "Brief overview of the changes and overall risk",
    "changes": [
        {
            "key": "configuration key name",
            "changeType": "added" | "modified" | "deleted",
            "riskLevel": "Low" | "Medium" | "High",
            "riskFactors": ["list of specific risk factors"]
        }
    ]
}`;
