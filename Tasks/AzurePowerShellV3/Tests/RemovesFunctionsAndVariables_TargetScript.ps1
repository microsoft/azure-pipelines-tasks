# Return key information.
$result = New-Object psobject -Property @{
    FunctionNames = @{ }
    VariableNames = @{ }
}
foreach ($function in (Get-ChildItem function:)) {
    $result.FunctionNames[$function.Name] = $function.Name
}

foreach ($variable in (Get-ChildItem variable:)) {
    $result.VariableNames[$variable.Name] = $variable.Name
}

$result