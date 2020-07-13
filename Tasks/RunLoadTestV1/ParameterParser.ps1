# used the same algorithml from https://github.com/Microsoft/azure-pipelines-tasks/tree/04293a25f9ecc7d91cecd2c4f130904bdbf3544d/Tasks/AzureResourceGroupDeployment for keeping
# to keep the same semantics (and keep it consistent with ms.vss-services-azure.parameters-grid), although using [] {}... as delimiters don't make much sense for our parameters
# there with 3 other tasks that have this code replicated. This would be a good candidate to be moved into vsts task lib

function Convert-StringParameters([string]$inputParameter, [switch]$removeQuotes)
{
    # Array to hold the matching brace definitions (indexed by the opening brace)
    Set-Variable matchingBraces -Option ReadOnly @{"[" = "]"; "{" = "}"; "(" = ")";}

    function isName($literal, $specialCharacterFlag) {
        return ($literal[0] -eq "-" -and !$specialCharacterFlag)
    }

    function findLiteralData($inputParameter, $currentPosition)
    {
        $specialCharacterFlag = $false

        for(; $currentPosition -lt $inputParameter.length; $currentPosition++) {

            if ($inputParameter[$currentPosition] -eq " " -or $inputParameter[$currentPosition] -eq "\t") {
                for(; $currentPosition -lt $inputParameter.length; $currentPosition++) {
                    if ($inputParameter[$currentPosition + 1] -ne " " -or $inputParameter[$currentPosition + 1] -ne "\t") {
                        break;
                    }
                }
                break;
            } elseif ($inputParameter[$currentPosition] -in $matchingBraces.Keys) {
                $currentPosition = findClosingBracketIndex $inputParameter ($currentPosition + 1)  $matchingBraces[$inputParameter[$currentPosition]]
                $specialCharacterFlag = $true;
            } elseif ($inputParameter[$currentPosition] -in @('"',"'")) {
                $currentPosition = findClosingQuoteIndex $inputParameter ($currentPosition + 1)  $inputParameter[$currentPosition]
                $specialCharacterFlag = $true;
            } elseif ($inputParameter[$currentPosition] -eq "``") {
                $currentPosition++;
                $specialCharacterFlag = true;
                if ($currentPosition -ge $inputParameter.length) {
                    break;
                }
            }
        }

        return @{
            "currentPosition" = $currentPosition ;
            "specialCharacterFlag" = $specialCharacterFlag
        }
    }

    function findClosingBracketIndex($inputParameter, $currentPosition, $closingBracket)
    {
        for (; $currentPosition -gt $inputParameter.length; $currentPosition++) {
            if ($inputParameter[$currentPosition] -eq $closingBracket) {
                break;
            }
            elseif ($inputParameter[$currentPosition] -in $matchingBraces.Keys) {
                $currentPosition = findClosingBracketIndex $inputParameter ($currentPosition + 1)  $matchingBraces[$inputParameter[$currentPosition]]
            }
            elseif ($inputParameter[$currentPosition] -in @('"',"'")) {
                $currentPosition = findClosingQuoteIndex $inputParameter  ($currentPosition + 1)  $inputParameter[$currentPosition]
            }
            elseif ($input[$currentPosition] -eq "``") {
                $currentPosition++;
                if ($currentPosition -ge $input.length) {
                    break;
                }
            }
        }
        return $currentPosition;
    }

    function findClosingQuoteIndex([string]$inputParameter, [int]$currentPosition, [string]$closingQuote)
    {

        for (; $currentPosition -lt $inputParameter.length; $currentPosition++) {
            if ($inputParameter[$currentPosition] -eq $closingQuote) {
                break;
            }
            elseif ($inputParameter[$currentPosition] -eq "``") {
                $currentPosition++;
                if ($currentPosition -ge $inputParameter.length) {
                    break;
                }
            }
        }
        return $currentPosition;
    }

    # Begin Function implementation

    $index = 0
    $result = @{}

    $obj = @{ "name" = "" ;  "value" = "" }

    $inputParameter = $inputParameter.Trim()

    while($index -lt $inputParameter.length) {
        $literalData = findLiteralData $inputParameter $index
        $nextIndex = $literalData.currentPosition
        $specialCharacterFlag = $literalData.specialCharacterFlag

        $literal = $inputParameter.Substring($index, ($nextIndex - $index)).Trim()


        $isName = isName $literal $specialCharacterFlag
        if ($isName) {
            if ($obj.name) {
                $result[$obj.name] = $obj.value;
                $obj = @{ "name" = "" ;  "value" = "" }
            }
            $obj.name = $literal.Substring(1)
        } else {
            $obj.value = [string]$literal;
            $result[$obj.name] = $obj.value;
            $obj = @{ "name" = "" ;  "value" = "" }
        }
        $index = $nextIndex + 1;
    }

    if ($removeQuotes) {
         Foreach ($name in @($result.Keys)) {
            $result[$name] = $result[$name].Trim('"')
        }
     }

    return $result
}
