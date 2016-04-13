Param(
  [Parameter(mandatory=$true)][string]$xmlFilePath,
  [Parameter(mandatory=$true)][string]$tag,
  [string]$conditionalAttributeKey,
  [string]$conditionalAttributeValue,
  [Parameter(mandatory=$true)][string]$targetKey,
  [Parameter(mandatory=$true)][string]$targetValue
)

Write-Verbose "xmlFile = $xmlFilePath" -Verbose
Write-Verbose "Tag = $tag" -Verbose
Write-Verbose "conditionalAttribute = $conditionalAttributeKey" -Verbose
Write-Verbose "conditionalValue = $conditionalAttributeValue" -Verbose
Write-Verbose "targetKey = $targetKey" -Verbose
Write-Verbose "targetValue = $targetValue" -Verbose


if( $conditionalAttribute -eq $null -xor $conditionalValue -eq $null) {
    Write-Verbose "Either conditionalAttribute and conditionalValue should be set or both should be blank" -Verbose
}

if (-not (test-path $xmlFilePath)) {
    throw "XML file path is not present."

}


<#
   UpdateXMLAttribute function takes xml node as argument and check if for any node it match with 
   target key for which value need to be changed, It update attribute value. Otherwise, it recursivly
   checks for all its child node.
#>
function UpdateXMLAttribute
{

    Param(
          [Parameter(mandatory=$true)][string]$tag,[string] $conditionalAttributeKey , [string] $conditionalAttributeValue ,[string] $targetKey, [string] $targetValue ,[Xml.XmlElement] $xml
    )
    
    if( $xml -eq $null ){
        return
    }

    foreach( $node in $xml.ChildNodes )
    {
        
        if( $node.Name -eq $tag ) 
        {
            foreach( $childNode in $node.ChildNodes ){   
                if(  (([string]::IsNullOrEmpty($conditionalAttributeKey) -eq $false -and  $childNode.GetAttribute($conditionalAttributeKey) -eq $conditionalAttributeValue) -or ([string]::IsNullOrEmpty($conditionalAttributeKey))) -and $childNode.GetAttribute($targetKey) -ne $null){
                    $childNode.SetAttribute($targetKey,$targetValue)
                    return
                }
            }
            
        }

        # If node has child recursivly check for each of child for properties
        if($node.ChildNodes.Count -gt 0 )
        {
           UpdateXMLAttribute -xml $node -tag $tag -conditionalAttributeKey $conditionalAttributeKey -conditionalAttributeValue $conditionalAttributeValue -targetKey $targetKey -targetValue $targetValue
        }
    }
}


$xml = [xml](Get-Content $xmlFilePath)
UpdateXMLAttribute -xml $xml.DocumentElement -tag $tag -conditionalAttributeKey $conditionalAttributeKey -conditionalAttributeValue $conditionalAttributeValue -targetKey $targetKey -targetValue $targetValue   
$xml.Save($file.FullName)





