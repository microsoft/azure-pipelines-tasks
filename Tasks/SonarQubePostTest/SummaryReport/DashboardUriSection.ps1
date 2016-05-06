
#
# Formats the dashboard URI section of the report, which displays a link to the SonarQube dashboard for the project, similar to: 
#
# <div style="padding: 10px 0px">
#     <a target="_blank" href="http://localhost:9000/dashboard/index?id=prca_test">Detailed SonarQube report &gt;</a>
# </div>
#
function GetDashboardUriSectionContent
{
     Write-Verbose "Formatting the dashboard uri report section"
    
     $dashboardUri = GetTaskContextVariable "MSBuild.SonarQube.ProjectUri"
     Assert (![String]::IsNullOrEmpty($dashboardUri)) "Could not find the dashboard uri"
     
     return (FormatSummarySection $dashboardUri)
}

function FormatSummarySection
{
    param ($dashboardUri)   
    
    $template = 
    '<div style="padding: 10px 0px">
        <a target="_blank" href="{0}">Detailed SonarQube report &gt;</a>
    </div>'
    
    $content = [String]::Format($template, $dashboardUri)
    return $content
}