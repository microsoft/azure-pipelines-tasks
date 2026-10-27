param(
    [string] $OutDirectory = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSHOME 'Newtonsoft.Json.dll')
New-Item -ItemType Directory -Force $OutDirectory | Out-Null

function U($codes) { -join ($codes | ForEach-Object { [char]$_ }) }

$intInputs = @(
    '8', ' 8', '8 ', ' 8 ', '+8', '-8', '0', '-0', '+0', '00012', '8x', 'x8', '', ' ', '+', '-', '--8', '+-8', '- 8', '+ 8',
    '1,000', '1.0', '1e3', '0x10', '2147483647', '2147483648', '-2147483648', '-2147483649', '9999999999999999999', '4294967296',
    "8`n", "`t8", "`r`n8`r`n", ("8" + (U 0)), ((U 0) + "8"), ((U 0xA0) + "8"), ("8" + (U 0xA0)), ((U 0x2003) + "8"), ((U 0x3000) + "8"),
    ((U 0x663)), ((U 0xFF18)), ((U 0xFF0D) + "8"), ((U 0x2212) + "8"), '1_000', '(8)', '8-', '$8', '8%', '8 8', '08', '0008', '٣',
    ("8" + [char]11), ([char]12 + "8"), ([char]11 + [char]12 + "8" + [char]13), 'true', 'NaN', '1e', '.5', '5.', '0.0', '1 000', "8$(U 0)$(U 0)", "8$(U 0)x", '١٢٣', '++8', '8+', ' - 8'
)
$ints = foreach ($s in $intInputs) {
    $n = 0
    $ok = [int]::TryParse($s, [ref]$n)
    [ordered]@{ input = $s; value = $(if ($ok) { $n } else { $null }) }
}

$boolInputs = @(
    'true', 'True', 'TRUE', 'tRuE', 'false', 'False', 'FALSE', 'fAlSe', ' true', 'true ', ' true ', "true`n", "`ttrue", "`r`ntrue`r`n", ("true" + (U 0)), ((U 0) + "true"), ((U 0) + " true " + (U 0)),
    ((U 0xA0) + "true"), ("true" + (U 0x2003)), ((U 0x85) + "true"), ("true" + (U 0x85)), ((U 0xFEFF) + "true"), ("true" + (U 0xFEFF)), ((U 0x200B) + "true"), ((U 0x180E) + "true"),
    'tru', 'truee', 't rue', ("tr" + (U 0) + "ue"), '1', '0', 'yes', 'no', 'on', 'off', '', ' ', (U 0), '+true', 'true;', '"true"', "'true'", ' False', 'False ', ' false ', ((U 0x85) + "false"), ((U 0xFEFF) + "false")
)

$guidSamples = @(
    '11111111-1111-1111-1111-111111111111', '0f8fad5b-d9cb-469f-a165-70867728950e', '0F8FAD5B-D9CB-469F-A165-70867728950E',
    '0f8fad5bd9cb469fa16570867728950e', '0F8FAD5BD9CB469FA16570867728950E', '{0f8fad5b-d9cb-469f-a165-70867728950e}', '(0f8fad5b-d9cb-469f-a165-70867728950e)',
    '{0f8fad5bd9cb469fa16570867728950e}', '(0f8fad5bd9cb469fa16570867728950e)',
    '{0x0f8fad5b,0xd9cb,0x469f,{0xa1,0x65,0x70,0x86,0x77,0x28,0x95,0x0e}}', '{0x0,0x0,0x0,{0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0}}',
    ' 0f8fad5b-d9cb-469f-a165-70867728950e', '0f8fad5b-d9cb-469f-a165-70867728950e ', " 0f8fad5b-d9cb-469f-a165-70867728950e`n", ((U 0xA0) + '0f8fad5b-d9cb-469f-a165-70867728950e'),
    '00000000-0000-0000-0000-000000000000', '', ' ', 'project-a', 'MyProject', '0f8fad5b-d9cb-469f-a165-70867728950', '0f8fad5b-d9cb-469f-a165-70867728950e0',
    '0f8fad5bd9cb-469f-a165-70867728950e', '0f8fad5b-d9cb469f-a165-70867728950e', '0f8fad5b-d9cb-469f-a165-7086-7728950e', '0f8fad5b_d9cb_469f_a165_70867728950e',
    '{0f8fad5b-d9cb-469f-a165-70867728950e', '0f8fad5b-d9cb-469f-a165-70867728950e}', '(0f8fad5b-d9cb-469f-a165-70867728950e}', '{{0f8fad5b-d9cb-469f-a165-70867728950e}}',
    'g f8fad5b-d9cb-469f-a165-70867728950e', '0f8fad5b-d9cb-469f-a165-70867728950g', '123', '12345678901234567890123456789012', '1234567890123456789012345678901',
    '123456789012345678901234567890123', '{0f8fad5b-d9cb-469f-a165-70867728950e} ', '0f8fad5b-d9cb-469f-a165-70867728950e,0',
    '{0X1,0X2,0X3,{0X4,0X5,0X6,0X7,0X8,0X9,0XA,0XB}}', '{ 0x1 , 0x2 , 0x3 , { 0x4 , 0x5 , 0x6 , 0x7 , 0x8 , 0x9 , 0xa , 0xb } }', '{0x123456789,0x2,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa,0xb}}',
    '{0x1,0x12345,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa,0xb}}', '{0x1,0x2,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa,0x123}}', '{0x,0x2,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa,0xb}}',
    '{0x1,0x2,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa}}', '{1,2,3,{4,5,6,7,8,9,10,11}}', '0x1,0x2,0x3,{0x4,0x5,0x6,0x7,0x8,0x9,0xa,0xb}',
    '{0f8fad5b-d9cb-469f-a165-70867728950e}{', '  {0f8fad5b-d9cb-469f-a165-70867728950e}  ', '0f8fad5b-d9cb-469f-a165-70867728950E', '0F8FAD5B-d9cb-469F-a165-70867728950e'
)
$guids = foreach ($s in $guidSamples) {
    $g = [guid]::Empty
    $ok = [guid]::TryParse($s, [ref]$g)
    [ordered]@{ input = $s; value = $(if ($ok) { $g.ToString() } else { $null }) }
}

$bools = foreach ($s in $boolInputs) {
    $b = $false
    $ok = [bool]::TryParse($s, [ref]$b)
    [ordered]@{ input = $s; value = $(if ($ok) { $b } else { $null }) }
}

$unicodeValue = '{"user-a":"h' + [char]0xE9 + 'llo ' + [char]0x2713 + '"}'
$nbspTail = '{"user-a":"b"}  ' + [char]0xA0
$bomPrefix = ([string][char]0xFEFF) + '{"user-a":"b"}'
$nulSuffix = '{"user-a":"b"}' + [char]0
$rawLineBreak = "{`"user-a`":`"line1`nline2`"}"
$propertyInputs = @(
    '{}', '{"user-a":"b"}', '{"user-a":1}', '{"user-a":1.0}', '{"user-a":1e3}', '{"user-a":1E+3}', '{"user-a":1.50}', '{"user-a":-0}', '{"user-a":-0.0}',
    '{"user-a":12345678901234567890}', '{"user-a":0.1e-2}', '{"user-a":123456789012345678901234567890.123456789012345678901234567890}',
    '{"user-a":true}', '{"user-a":false}', '{"user-a":null}',
    '{"user-a":"\u0041\n\t\"x\\"}', $unicodeValue, $rawLineBreak, '{"user-a":"\ud83d\ude00"}', '{"user-a":"bad \q escape"}', '{"user-a":"it\''s"}', "{'user-a':'it\'s \`"q\`"'}", '{"user-a":"2020-01-01T00:00:00Z"}', '{"user-a":"/Date(1234567890000)/"}',
    '{"user-a":{"x":1}}', '{"user-a":[1,2]}', '{"user-a":[]}', '{"user-a":{}}', '{"user-a":"x","user-b":{"y":2}}',
    '{"":"v"}', '{" ":"v"}', '{"":"v","bad":"w"}', '{"bad":"w","":"v"}', '{"bad":"w"}', '{"user-a":"b","bad":"w"}', '{"user-a":"1","user-a":"2"}',
    '{ "user-a" : "b" , "user-c" : "d" }', "{`n  `"user-a`": `"b`",`r`n  `"user-c`": 3`n}",
    '{"user-a":"b"} ', ' {"user-a":"b"}', '{"user-a":"b"}x', '{"user-a":"b"}{"user-c":"d"}', '{"user-a":"b",}', "{'user-a':'b'}", '{user-a:"b"}', '{"user-a":"b"/*c*/}', "// c`n{`"user-a`":`"b`"}", '{"user-a":"b"} // tail',
    '[1,2]', '"abc"', '123', 'null', 'true', '', '   ',
    '{"user-a":01}', '{"user-a":+1}', '{"user-a":.5}', '{"user-a":1.}', '{"user-a":0x10}', '{"user-a":NaN}', '{"user-a":Infinity}', '{"user-a":-Infinity}',
    '{"user-a":"b"', '{"user-a" "b"}', '{"user-a":}', '{"user-a":undefined}', '{"user-a":True}', '{"user-a":TRUE}', '{"user-a":"b""c"}',
    '{"user-a":1,"user-b":2.0,"user-c":"3","user-d":true}', '{"user-a":-1}', '{"user-a":1e400}', '{"user-a":-1e-400}',
    '{"user-a":08}', '{"user-a":07}', '{"user-a":0x}', '{"user-a":0xFFFFFFFFFFFFFFFF}', '{"user-a":0x10000000000000000}', '{"user-a":00.5}', '{"user-a":0e1}', '{"user-a":-.5}', '{"user-a":1e+}',
    '{"user-a":1.2.3}', '{"user-a":1f}', '{"user-a":12abc}', '{"user-a":-}', '{"user-a":--1}', '{"user-a":1-2}', '{"user-a":1e5.5}', '{"user-a":"x" "y"}', '{"user-a":0}', '{"user-a":-1.5e-7}',
    '{"user-a":1,,"user-b":2}', '{,"user-a":1}', '{"user-a":1 "user-b":2}', '{"user-a":"b"}/', '{"user-a":"b"}/* c */', '{"user-a":"b"}/* c', '/* c */{"user-a":"b"}', '{/* c */"user-a"/* c */:/* c */"b"/* c */,/* c */}',
    $nbspTail, $bomPrefix, $nulSuffix, '{"user-a":-Infinity,"user-b":Infinity,"user-c":NaN}', '{"user-a":-NaN}', '{"user-a":infinity}', '{"user-a":nan}'
)

function Convert-Properties([string] $json, $settings) {
    try {
        $r = [Newtonsoft.Json.JsonConvert]::DeserializeObject($json, [System.Collections.Generic.IDictionary[string, string]], $settings)
        if ($null -eq $r) { return [ordered]@{ input = $json; status = 'null' } }
        $pairs = @(foreach ($k in $r.Keys) { , @($k, $r[$k]) })
        return [ordered]@{ input = $json; status = 'ok'; pairs = $pairs }
    } catch {
        $e = $_.Exception
        if ($e -is [System.Management.Automation.MethodInvocationException]) { $e = $e.InnerException }
        $top = $e.GetType().Name
        $isJson = $e -is [Newtonsoft.Json.JsonException]
        while ($e.InnerException) { $e = $e.InnerException }
        return [ordered]@{ input = $json; status = 'error'; error = $top; root = $e.GetType().Name; jsonException = $isJson }
    }
}

$settings = [Newtonsoft.Json.JsonSerializerSettings]::new()
$settings.NullValueHandling = [Newtonsoft.Json.NullValueHandling]::Ignore
$settings.DateFormatHandling = [Newtonsoft.Json.DateFormatHandling]::IsoDateFormat
$properties = foreach ($j in $propertyInputs) { Convert-Properties $j $settings }

# Every UTF-16 code unit: is it white space for char.IsWhiteSpace (and so for string.Trim and string.IsNullOrWhiteSpace), may it surround
# a GUID for Guid.TryParse, may it surround a number for int.TryParse, may it surround "true" for bool.TryParse?
$referenceGuid = '0f8fad5b-d9cb-469f-a165-70867728950e'
$whitespace = [System.Collections.Generic.List[int]]::new()
$guidLeading = [System.Collections.Generic.List[int]]::new()
$guidTrailing = [System.Collections.Generic.List[int]]::new()
$intLeading = [System.Collections.Generic.List[int]]::new()
$intTrailing = [System.Collections.Generic.List[int]]::new()
$boolLeading = [System.Collections.Generic.List[int]]::new()
$boolTrailing = [System.Collections.Generic.List[int]]::new()
$parsedGuid = [guid]::Empty
$parsedInt = 0
$parsedBool = $false
foreach ($code in 0..65535) {
    $unit = [string][char]$code
    if ([char]::IsWhiteSpace([char]$code)) { $whitespace.Add($code) }
    if ([guid]::TryParse($unit + $referenceGuid, [ref]$parsedGuid)) { $guidLeading.Add($code) }
    if ([guid]::TryParse($referenceGuid + $unit, [ref]$parsedGuid)) { $guidTrailing.Add($code) }
    if ([int]::TryParse($unit + '8', [ref]$parsedInt)) { $intLeading.Add($code) }
    if ([int]::TryParse('8' + $unit, [ref]$parsedInt)) { $intTrailing.Add($code) }
    if ([bool]::TryParse($unit + 'true', [ref]$parsedBool) -and $parsedBool) { $boolLeading.Add($code) }
    if ([bool]::TryParse('true' + $unit, [ref]$parsedBool) -and $parsedBool) { $boolTrailing.Add($code) }
}

[ordered]@{
    generator = 'Generate-DotNetParseVectors.ps1'
    runtime = [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
    newtonsoft = (Get-Item (Join-Path $PSHOME 'Newtonsoft.Json.dll')).VersionInfo.FileVersion
    culture = [System.Globalization.CultureInfo]::CurrentCulture.Name
    whitespace = @($whitespace)
    guidLeading = @($guidLeading)
    guidTrailing = @($guidTrailing)
    intLeading = @($intLeading)
    intTrailing = @($intTrailing)
    boolLeading = @($boolLeading)
    boolTrailing = @($boolTrailing)
    int32 = @($ints)
    guid = @($guids)
    bool = @($bools)
    properties = @($properties)
} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $OutDirectory 'dotnet-parse-vectors.json') -Encoding utf8

"ints: $(@($ints).Count)  accepted: $(@($ints | Where-Object { $null -ne $_.value }).Count)"
"guids: $(@($guids).Count)  accepted: $(@($guids | Where-Object { $null -ne $_.value }).Count)"
"bools: $(@($bools).Count)  accepted: $(@($bools | Where-Object { $null -ne $_.value }).Count)  true: $(@($bools | Where-Object { $_.value -eq $true }).Count)"
"properties: $(@($properties).Count)  ok: $(@($properties | Where-Object { $_.status -eq 'ok' }).Count)"
"white space code units: $($whitespace.Count); around a GUID: $($guidLeading.Count) before, $($guidTrailing.Count) after; around an int: $($intLeading.Count) before, $($intTrailing.Count) after; around true: $($boolLeading.Count) before, $($boolTrailing.Count) after"
