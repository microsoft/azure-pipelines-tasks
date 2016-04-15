Param(
  [String][Parameter(mandatory=$true)]$xmlFilePath,
  [String][Parameter(mandatory=$true)][string]$tag,
  [String][Parameter(mandatory=$false)]$conditionalAttributeKey,
  [String][Parameter(mandatory=$false)]$conditionalAttributeValue,
  [String][Parameter(mandatory=$true)][string]$targetKey,
  [String][Parameter(mandatory=$true)][string]$targetValue
)

Write-Verbose "xmlFile = $xmlFilePath" 
Write-Verbose "Tag = $tag" 
Write-Verbose "conditionalAttribute = $conditionalAttributeKey" 
Write-Verbose "conditionalValue = $conditionalAttributeValue" 
Write-Verbose "targetKey = $targetKey" 


if( [string]::IsNullOrEmpty($conditionalAttribute) -xor [string]::IsNullOrEmpty($conditionalValue)) {
    Write-Verbose "Either conditionalAttribute and conditionalValue should be set or both should be blank."
}

if (-not (test-path $xmlFilePath)) {
    throw "Specified XML file path doesn't exists."
}


<#
   UpdateXMLAttribute function takes xml node as argument and check if for any node it match with 
   target key for which value need to be changed, It update attribute value. Otherwise, it recursivly
   checks for all its child node.
#>
function UpdateXMLAttribute
{

    Param(
          [String][Parameter(mandatory=$true)] $tag,
          [String][Parameter(mandatory=$false)] $conditionalAttributeKey,
          [String][Parameter(mandatory=$false)] $conditionalAttributeValue,
          [String][Parameter(mandatory=$true)] $targetKey,
          [String][Parameter(mandatory=$true)] $targetValue,
          [Object][Parameter(mandatory=$true)] $xml
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





