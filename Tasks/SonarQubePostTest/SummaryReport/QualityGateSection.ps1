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
            $metricName = GetMetricNameDisplayLabel $metricNames $failedCondition.metricKey
            $comparator = GetComparatorDisplayLabel $failedCondition.comparator
            $color = GetMetricValueColor $failedCondition.status                        
            $value = GetMetricValueDisplayLabel $metricNames $failedCondition.metricKey $failedCondition.actualValue
            $threshold = GetThresholdDisplayLabel $metricNames $failedCondition 
            
            $properties = @{
                'status'= $failedCondition.status
                'metric_name'= $metricName
                'comparator'= $comparator
                'threshold' = $threshold
                'actualValue'= $value
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

function GetThresholdDisplayLabel
{
    param ($metricNames, $failedCondition)
    
    if ($failedCondition.status -eq "error")
    {
        $metricValue = $failedCondition.errorThreshold   
    }                        
    else
    {
        $metricValue = $failedCondition.warningThreshold   
    }    
    
    $metric = GetMatchingMetric $metricNames $failedCondition.metricKey
    
    return (GetMetricValueWithUnit $metric $metricValue)
}

function GetMetricValueDisplayLabel
{
    param ($metricNames, $metricKey, $metricValue)
    
    $metric = GetMatchingMetric $metricNames $metricKey
    
    return (GetMetricValueWithUnit $metric $metricValue)
}

function GetMetricValueWithUnit
{
    param ($metric, $metricValue)
    
    if ($metric -eq $null)
    {
        return $metricValue
    }
    
    $type = $metric.type
    Write-Verbose "$($metric.name) -  type is $type with the value $metricValue"
    
    if ($type -eq "WORK_DUR")
    {
        return (GetWorkDurationLabel ($metricValue -as [int]))
    } 
    
    # Show a single decimal digit
    $doubleValue = $metricValue -as [double]
    
    if ($doubleValue -ne $null)
    {
        $metricValue = [Math]::Round($doubleValue, 1)
    }

    $unit = GetUnitDisplayLabel $type
    return ($metricValue.ToString() + $unit)    
}

function GetMetricNameDisplayLabel
{
    param ($metricNames, $metricKey)
    
    $metric = GetMatchingMetric $metricNames $metricKey
    if ($metric -eq $null)
    {
        return $metricKey
    }
  
    return $metric.name
}

function GetMatchingMetric
{
     param ($metricNames, $metricKey)
     
    $matchingMetric = $metricNames | Where-Object {$_.key -eq $metricKey} 
    
    if (!(HasElements $matchingMetric))
    {
        Write-Warning "No metric with the key $metricKey found"
        return $null  
    } 
    
    if (@($matchingMetric).Count -gt 1) 
    {
        Write-Warning "Multiple metrics with the key $metricKey found"
        return $null      
    }
    
    return $matchingMetric
}

#
# SonarQube gives work durations in minutes and it uses complex logic to transform those values to hours, work days, weeks, months etc. 
# At this point we only show hours and minutes.
#
function GetWorkDurationLabel
{
    param ($totalMinutes)
    
    $displayValue = ""
    $ts = New-Object "TimeSpan" -ArgumentList @(0, $totalMinutes, 0) 
    $totalHours = [Math]::Floor($ts.TotalHours)
    $minutes = $ts.Minutes
    
    if ($totalHours -gt 0)
    {
        $displayValue = $totalHours.ToString() + "h"
        if ($minutes -gt 0)
        {
             $displayValue += " " + $minutes.ToString() + "min"
        }
    }
    else
    {
        $displayValue = $minutes.ToString() + "min"
    }
    
    return $displayValue
}

#
# Returns a label for the measurment unit as stored by SonarQube. Based on the api/metrics/types API 
#
function GetUnitDisplayLabel
{
     param ($unit)
    
     switch ($unit)      
     {
        {$_ -eq "PERCENT"} 
        {
                return '%'
        }
        {$_ -eq "MILLISEC"} 
        {
                return 'ms'
        }              
        Default 
        {
            return ""
        }
     }
}

function GetComparatorDisplayLabel
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