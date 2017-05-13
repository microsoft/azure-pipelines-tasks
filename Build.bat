call npm install gulp -g
@if "%ERRORLEVEL%" neq "0" (
  @goto Error
)

call npm install
@if "%ERRORLEVEL%" neq "0" (
  @goto Error
)

call gulp
@if "%ERRORLEVEL%" neq "0" (
  @goto Error
)

@goto Exit

:Error
@echo Command exited with error code %ERRORLEVEL%.

:Exit