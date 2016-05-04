function Substitute-XMLAttributeValue
{

    Param(
        [String][Parameter(mandatory=$true)]
        $xmlFilePath,
        [String][Parameter(mandatory=$true)]
        $tag,
        [String][Parameter(mandatory=$false)]
        $conditionalAttributeKey,
        [String][Parameter(mandatory=$false)]
        $conditionalAttributeValue,
        [String][Parameter(mandatory=$true)]
        $targetKey,
        [String][Parameter(mandatory=$true)]
        $targetValue
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

    # Replace value of key for a particular tag
    function UpdateXMLAttribute
    {

        Param(
              [Xml.XmlElement][Parameter(mandatory=$true)] 
              $xml,
              [String][Parameter(mandatory=$true)] 
              $tag,
              [String][Parameter(mandatory=$false)] 
              $conditionalAttributeKey,
              [String][Parameter(mandatory=$false)] 
              $conditionalAttributeValue,
              [String][Parameter(mandatory=$true)] 
              $targetKey,
              [String][Parameter(mandatory=$true)] 
              $targetValue
          
        )
    
        $node = $xml.SelectSingleNode("//$tag")
   
        if( $node -eq $null )
        {
            Write-Verbose "$tag node is node found in provided xml file" -Verbose
            return
        }
        
        foreach( $childNode in $node.ChildNodes )
        {   
            if(  (([string]::IsNullOrEmpty($conditionalAttributeKey) -eq $false -and  $childNode.GetAttribute($conditionalAttributeKey) -eq $conditionalAttributeValue) -or ([string]::IsNullOrEmpty($conditionalAttributeKey))) -and $childNode.GetAttribute($targetKey) -ne $null)
            {
                $childNode.SetAttribute($targetKey,$targetValue)
                return
            }
        }
    
    }

    $xmlContent = [xml](Get-Content $xmlFilePath)
    UpdateXMLAttribute -xml $xmlContent.DocumentElement -tag $tag -conditionalAttributeKey $conditionalAttributeKey -conditionalAttributeValue $conditionalAttributeValue -targetKey $targetKey -targetValue $targetValue   
    $xmlContent.Save($xmlFilePath)

}
