#
# Displays the quality gate status and, if the quality gate status is error or warning, any conditions that led to this.
# 
# Example output:
# 
# <div style="padding:5px 0px">
#    <span>Quality Gate</span>
#    <span style="padding:4px 10px; margin-left: 5px; background-color:#d4333f; color:#fff; display:inline-block">Failed</span>
# </div>
#
#<table border="0" style="border-top: 1px solid #eee;border-collapse: separate;border-spacing: 0 2px;">
#    <tbody><tr>
#        <td><span style="padding-right:4px;">Duplicated blocks</span></td>
#        <td style="text-align: center; background-color:#d4333f; color:#fff;"><span style="padding:0px 2px">0</span></td>
#        <td>&nbsp;&lt; 5</td>
#    </tr>    
#    <tr>
#        <td><span style="padding-right:4px;">Blocker issues</span></td>
#        <td style="text-align: center; background-color:#f90; color:#fff;"><span style="padding:0px 2px">0</span></td>
#        <td>&nbsp;= 0</td>
#    </tr>
#</tbody></table>
#
# This corresponds to:
# 
# Quality Gate: Failed 
# Duplicated blocks 0 < 5
# Blocker issues 0 != 0
#
function GetQualityGateSectionContent
{
    Write-Verbose "Formatting the quality gate report section"
    
    WaitForAnalysisToFinish
    
    $qualityGateResponse = FetchQualityGateDetails
    $qualityGateStatus = $qualityGateResponse.projectStatus.status
    $section1 = FormatQualityGateStatusSection $qualityGateStatus
    
    $warningsAndErrors = GetQualityGateWarningsAndErrors $qualityGateResponse    
    $section2 = FormatQualityGateMessagesSection $warningsAndErrors
    
    $content = FormatQualityGateSection $section1 $section2
    return $content
}

function FormatQualityGateSection
{
    param ($section1, $section2)
    
    return "$section1 $section2"
}

function FormatQualityGateMessagesSection
{
    param ($messages)
    
    $sb = New-Object "System.Text.StringBuilder"
    
    if (HasElements $messages)
    {
        [void]$sb.AppendLine('<table border="0" style="border-top: 1px solid #eee;border-collapse: separate;border-spacing: 0 2px;">')
        
        foreach ($message in $messages)
        {
            Write-Verbose "Value $($message.actualValue)"
            
            [void]$sb.AppendLine("<tr>")
            [void]$sb.AppendLine("<td><span style=""padding-right:4px;"">$($message.metric_name)</span></td>")
            [void]$sb.AppendLine("<td style=""text-align: center; background-color:$($message.color); color:#fff;""><span style=""padding:0px 2px"">$($message.actualValue)</span></td>")
            [void]$sb.AppendLine('<td>&nbsp;' + $message.comparator + ' ' + $message.threshold + '</td>')
            [void]$sb.AppendLine("</tr>")
        }
        
        [void]$sb.AppendLine("</table>")
    } 
    
    return $sb.ToString()
}

function FormatQualityGateStatusSection  
{
    param ($qualityGateStatus)   
    
    $qualityGateColor = "" 
    $qualityGateLabel = ""
    GetQualityGateStatusVisualDetails $qualityGateStatus ([ref]$qualityGateColor) ([ref]$qualityGateLabel)
    
    $template  = '<div style="padding:5px 0px">
<span>Quality Gate</span>
<span style="padding:4px 10px; margin-left: 5px; background-color:{0}; color:#fff; display:inline-block">{1}</span>
</div>'
    
    $reportContents = [String]::Format($template, $qualityGateColor, $qualityGateLabel)
    return $reportContents
}

#
# Fetches the quality gate status and the errors and warnings and also the metrics in order to provide a user friendly report.
# Note: this is method is unit tested
#
function GetQualityGateWarningsAndErrors
{
    param ([ValidateNotNull()]$qualityGateResponse)
    
    $messages = New-Object "System.Collections.ArrayList"
    
    $failedConditions  = $qualityGateResponse.projectStatus.conditions | Where-Object {($_.status -eq "error") -or ($_.status -eq "warn") }
    if ($failedConditions -ne $null)
    {
        $metricNames = FetchMetricNames
        foreach ($failedCondition in $failedConditions)
        {
            $metricName = GetMetricFriendlyName $metricNames $failedCondition.metricKey
            $comparator = GetComparatorDisplayValue $failedCondition.comparator
            $color = GetMetricValueColor $failedCondition.status            
            
            if ($failedCondition.status -eq "error")
            {
                $threshold = $failedCondition.errorThreshold   
            }
                        
            if ($failedCondition.status -eq "warn")
            {
                $threshold = $failedCondition.warningThreshold   
            }
            
            $properties = @{
                'status'=$failedCondition.status
                'metric_name'=$metricName
                'comparator'=$comparator
                'threshold' = $threshold
                'actualValue'= $failedCondition.actualValue
                'color' = $color
            }
            
            $message = New-Object PSObject -Property $properties
            [void]$messages.Add($message)
        }
    }
    
    # sort by status to have the errors first and the warnings
    $messages = $messages | Sort-Object status
    return $messages
}

function GetMetricFriendlyName
{
    param ($metricNames, $metricKey)
    $matchingMetric = $metricNames | Where-Object {$_.key -eq $metricKey} 
    
    Assert (HasElements $matchingMetric) "No metric with the key $metricKey found"
    Assert (@($matchingMetric).Count -eq 1) "Multiple metrics with the key $metricKey found"
    
    $name = $matchingMetric.name 
    
    return $name
}

function GetComparatorDisplayValue
{
    param ($comparator)
    
     switch ($comparator)      
     {
        {$_ -eq "EQ"} 
            {
                return '&#61;'
            }
        {$_ -eq "GT"} 
            {
                return '&#62;'
            }
        {$_ -eq "LT"} 
            {
                return '&#60;'
            }
        {$_ -eq "NE"} 
            {
                return '&#8800;'
            }
        Default 
        {
            Write-Warning "Unknown operator $comparator"
            return $comparator;
        }
     }
}

function GetMetricValueColor
{
    param ($status)
    
     switch ($status)      
     {
        {$_ -eq "error"} 
        {
                return '#d4333f'
        }
        {$_ -eq "warn"} 
        {
                return '#f90'
        }            
        Default 
        {
            return ""
        }
     }
}

function GetQualityGateStatusVisualDetails
{
    param([string]$qualityGateStatus, [ref][string]$color, [ref][string]$label)
    
    
    switch ($qualityGateStatus)    
    {
        {$_ -eq "ok"} 
        { 
            $color.Value = "#85BB43"
            $label.Value = "Passed" 
            break;           
        }
        {$_ -eq "warn"} 
        {
            $color.Value = "#f90"
            $label.Value = "Warning" 
            break;            
        }
        {$_ -eq "error"} 
        {
            $color.Value = "#d4333f"
            $label.Value = "Failed"
            break;  
        }
        {$_ -eq "none"} 
        {
            $color.Value = "#bbb" 
            $label.Value = "None"
            break;  
        }
        Default 
        {
            Write-Warning "Could not detect the quality gate status or a new status has been introduced."
            $color.Value = "#bbb" 
            $label.Value = "Unknown"
            break;  
        }
    }
}