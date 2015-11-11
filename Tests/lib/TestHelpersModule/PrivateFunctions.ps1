function Compare-ArgumentArrays {
    [cmdletbinding()]
    param(
        [object[]]$Array1,
        [object[]]$Array2
    )

    if ($Array1.Length -ne $Array2.Length) {
        return $false
    }

    for ($i = 0 ; $i -lt $Array1.Length ; $i++) {
        $value1 = $Array1[$i]
        $value2 = $Array2[$i]
        if (($value1 -is [string]) -and ($value1 -eq '') -and ([object]::ReferenceEquals($value2, $null))) {
            # Treat the values as matching.
        } elseif (($value2 -is [string]) -and ($value2 -eq '') -and ([object]::ReferenceEquals($value1, $null))) {
            # Treat the values as matching.
        } elseif ($value1 -eq $value2) {
            # The values match.
        } else {
            return $false
        }
    }

    return $true
}
