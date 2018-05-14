PRINT 'Begin Sql scripts execution'
SET XACT_ABORT ON
SET NOCOUNT ON

DECLARE @_acquireLock VARCHAR(64)
DECLARE @_acquireLockMilliseconds INT
DECLARE @_acquireLockMaxAttempts INT
DECLARE @_longRunningThresholdMilliSeconds INT
DECLARE @_acquireLockLastNAttempts INT

IF OBJECT_ID (N'#_tmpSqlFilesTable', N'U') IS NOT NULL  
BEGIN 
	PRINT 'Temporary table exists already. Dropping table #_tmpSqlFilesTable' 
	DROP TABLE #_tmpSqlFilesTable 
END

CREATE TABLE #_tmpSqlFilesTable (ScriptIndex INT NOT NULL IDENTITY PRIMARY KEY CLUSTERED, SqlScriptContent NVARCHAR(MAX) NOT NULL)

DECLARE @_fileList NVARCHAR(MAX)
DECLARE @_fileName NVARCHAR(MAX)
DECLARE @_pos INT
DECLARE @_insertFileCommand NVARCHAR(MAX)
DECLARE @_errorCode INT
DECLARE @_errorMessage NVARCHAR(4000);  
DECLARE @_errorSeverity INT;  
DECLARE @_errorState INT;

SET @_fileList = '$(_fileList)'
WHILE LEN(@_fileList) > 0
BEGIN
	SET @_pos = CHARINDEX(';', @_fileList)
	IF (@_pos = 0)
	BEGIN
		SET @_fileName = @_fileList
		SET @_fileName = LTRIM(@_fileName)
		SET @_fileName = RTRIM(@_fileName)
		IF (LEN(@_fileName) > 0)
		BEGIN
			BEGIN TRY
				PRINT 'Trying to load file in ASCII format'
				SET @_insertFileCommand = 'insert #_tmpSqlFilesTable (SqlScriptContent) select * from OPENROWSET(bulk ''' + @_fileName + ''', SINGLE_CLOB) as a'
				EXEC sp_ExecuteSql @_insertFileCommand
			END TRY
			BEGIN CATCH
				SET @_errorCode = @@ERROR
				IF (@_errorCode = 4809) 
				BEGIN 
					PRINT 'ASCII format failed. Trying to load file in UNICODE format'
					SET @_insertFileCommand = 'insert #_tmpSqlFilesTable (SqlScriptContent) select * from OPENROWSET(bulk ''' + @_fileName + ''', SINGLE_NCLOB) as a'
					EXEC sp_ExecuteSql @_insertFileCommand
					SET @_errorCode = @@ERROR
				END
				IF (@_errorCode <> 0)
				BEGIN
					SELECT @_errorMessage = ERROR_MESSAGE(), @_errorSeverity = ERROR_SEVERITY(), @_errorState = ERROR_STATE();  
					RAISERROR (@_errorMessage, @_errorSeverity, @_errorState) WITH NOWAIT
				END
			END CATCH
		END
		SET @_fileList = ''
	END
	ELSE
	BEGIN
		SET @_fileName = SUBSTRING(@_fileList, 1, @_pos - 1)
		SET @_fileName = LTRIM(@_fileName)
		SET @_fileName = RTRIM(@_fileName)
		IF (LEN(@_fileName) > 0)
		BEGIN
			BEGIN TRY
				PRINT 'Trying to load file in ASCII format'
				SET @_insertFileCommand = 'insert #_tmpSqlFilesTable (SqlScriptContent) select * 	from OPENROWSET(bulk ''' + @_fileName + ''', SINGLE_CLOB) as a'
				EXEC sp_ExecuteSql @_insertFileCommand
			END TRY
			BEGIN CATCH
				SET @_errorCode = @@ERROR
				IF (@_errorCode = 4809)
				BEGIN 
					PRINT 'ASCII format failed. Trying to load file in UNICODE format'
					SET @_insertFileCommand = 'insert #_tmpSqlFilesTable (SqlScriptContent) select * from OPENROWSET(bulk ''' + @_fileName + ''', SINGLE_NCLOB) as a'
					EXEC sp_ExecuteSql @_insertFileCommand
					SET @_errorCode = @@ERROR
				END
				IF (@_errorCode <> 0)
				BEGIN
					SELECT @_errorMessage = ERROR_MESSAGE(), @_errorSeverity = ERROR_SEVERITY(), @_errorState = ERROR_STATE();  
					RAISERROR (@_errorMessage, @_errorSeverity, @_errorState) WITH NOWAIT
				END
			END CATCH
		END
		SET @_fileList = SUBSTRING(@_fileList, @_pos + 1, LEN(@_fileList) - @_pos)
	END
END
PRINT 'Completed adding files in temporary table'

PRINT 'Acquiring applock if specified'
SET @_acquireLock = $(_acquireLockParam)
SET @_acquireLockMilliseconds = $(_acquireLockMillisecondsParam)
SET @_acquireLockMaxAttempts = $(_acquireLockMaxAttemptsParam)
SET @_longRunningThresholdMilliSeconds = $(_longRunningThresholdMilliSecondsParam)
SET @_acquireLockLastNAttempts = $(_acquireLockLastNAttemptsParam)

DECLARE @_batch NVARCHAR(MAX) = ''
DECLARE @_batchIndex INT
DECLARE @_statusMessage NVARCHAR(MAX)
DECLARE @_acquireLockAttemptStart DATETIME
DECLARE @_acquireLockStart DATETIME
DECLARE @_milliSecondsUnderLock INT
DECLARE @_maxMilliSecondsUnderLock INT
DECLARE @_batchStartTime DATETIME
DECLARE @_batchMessage VARCHAR(100)

SET @_statusMessage = '@SPID=' + CONVERT(VARCHAR(6), @@SPID)
RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT

SELECT  @_acquireLock = COALESCE(@_acquireLock, '')

IF (@_acquireLock <> '')
BEGIN
    DECLARE @_result                INT = -1
    DECLARE @_attempt               INT = 1
    DECLARE @_noWaitAttempt         INT = 1
    DECLARE @_shortLockName         NVARCHAR(32) = @_acquireLock

    SET @_statusMessage = 'Trying to Acquire Lock #1:' + CONVERT(VARCHAR, GETUTCDATE(), 109)
    PRINT @_statusMessage

    SET @_acquireLockAttemptStart = GETUTCDATE()
    
    BEGIN TRAN

	EXEC @_result = sp_getapplock  @Resource = @_acquireLock, @LockMode = 'Exclusive', @LockTimeout = 0

	IF @_result < 0
    BEGIN
		WHILE @_attempt <= @_acquireLockMaxAttempts
		BEGIN			
			SET @_acquireLockStart = GETUTCDATE()
        	SET @_statusMessage = 'Acquiring servicing lock: @attempt=' + CONVERT(VARCHAR(10), @_attempt) + '@timestamp=' + CONVERT(VARCHAR, GETUTCDATE(), 109)
			RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT

			if @_attempt = @_acquireLockMaxAttempts - @_acquireLockLastNAttempts + 1
				SET @_acquireLockMilliseconds = @_acquireLockMilliseconds + 10 * 1000
				EXEC @_result = sp_getapplock  @Resource = @_acquireLock, @LockMode = 'Exclusive', @LockTimeout = @_acquireLockMilliseconds
				if @_result >= 0
					BREAK
				SET @_statusMessage = 'Servicing lock attempt ' + CONVERT(VARCHAR(10), @_attempt) + ' result: Timed out while acquiring the lock.'
				RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT
			
			SET @_attempt = @_attempt + 1
			SET @_noWaitAttempt = 1
			WHILE @_noWaitAttempt <= 15
			BEGIN
				WAITFOR DELAY '00:00:01';
				EXEC @_result = sp_getapplock  @Resource = @_acquireLock, @LockMode = 'Exclusive', @LockTimeout = 0
				IF @_result >= 0
					BREAK
				SET @_noWaitAttempt = @_noWaitAttempt + 1
			END

			IF @_result >= 0
				BREAK
		END
	END

    IF @_result < 0
    BEGIN
        ROLLBACK TRAN
        RAISERROR('Failed to acquire an exclusive servicing lock', 16, -1)
        RETURN
    END
    SET @_statusMessage = 'Lock acquired:' + CONVERT(VARCHAR, GETUTCDATE(), 109) + ' time to acquire lock:' + CONVERT(VARCHAR, DateDiff(ms, @_acquireLockAttemptStart, GETUTCDATE()), 109) + ' ms'
    RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT
END
PRINT 'Completed acquiring applock if specified'

PRINT 'Begin executing scripts'
DECLARE batchCursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT  SqlScriptContent
    FROM    #_tmpSqlFilesTable
	ORDER BY ScriptIndex ASC

OPEN batchCursor

FETCH NEXT 
FROM batchCursor
INTO @_batch

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @_batchStartTime = GETUTCDATE()
    SET @_batchMessage = 'Executing Script: ' + CONVERT(VARCHAR(25), @_batchStartTime, 21)
    RAISERROR (@_batchMessage, 0, 231)
    SET @_batch = REPLACE(@_batch, ',MAX_GRANT_PERCENT=1', '/*,MAX_GRANT_PERCENT=1*/')

    EXEC sp_ExecuteSql @_batch
    IF @@ERROR <> 0  
    BEGIN
        IF @_acquireLock <> '' 
        BEGIN
		    PRINT 'Script execution failed. Rolling back'
            ROLLBACK TRAN
        END
        RETURN
    END

    FETCH   NEXT FROM batchCursor
    INTO    @_batch
END
SET @_batchMessage = 'Completing Script execution: ' + CONVERT(VARCHAR(25), GETUTCDATE(), 21)
RAISERROR (@_batchMessage, 0, 231)

CLOSE batchCursor
DEALLOCATE batchCursor

IF @_acquireLock <> ''

BEGIN
    COMMIT TRAN
    SET @_milliSecondsUnderLock = DATEDIFF(ms, @_acquireLockStart,  GETUTCDATE())
    if @_milliSecondsUnderLock >= 10000
        SET @_statusMessage = 'WARNING!! Time under lock exceeds 10 seconds - Time: ' + CONVERT(VARCHAR, @_milliSecondsUnderLock, 109) + ' ms'
    ELSE
        SET @_statusMessage = 'Time under lock: ' + CONVERT(VARCHAR, @_milliSecondsUnderLock, 109)  + ' ms'
    PRINT @_statusMessage 
END

IF @@TRANCOUNT > 0
BEGIN
	PRINT 'Transaction execution failed. Rolling back'
    ROLLBACK TRAN
END

DROP TABLE #_tmpSqlFilesTable 