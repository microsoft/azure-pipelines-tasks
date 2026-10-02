[System.IO.File]::WriteAllText($env:CROSS_PROCESS_CUSTOMER_SCRIPT_MARKER, "executed")
throw "Customer script failed after certificate import"