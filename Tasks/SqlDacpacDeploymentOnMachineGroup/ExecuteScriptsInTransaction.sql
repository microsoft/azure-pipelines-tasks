PRINT 'Begin Sql scripts execution'
SET XACT_ABORT ON
SET NOCOUNT ON

DECLARE @_acquireLock VARCHAR(64)
DECLARE @_acquireLockMilliseconds INT
DECLARE @_acquireLockMaxAttempts INT
DECLARE @_longRunningThresholdMilliSeconds INT
DECLARE @_lastAttemptsToKillSessions INT
DECLARE @_isHosted INT

PRINT 'Adding SQL files into temporary table #_tmpSqlFilesTable'

IF OBJECT_ID (N'#_tmpSqlFilesTable', N'U') IS NOT NULL 
BEGIN
   PRINT 'Temporary table exists already. Dropping table #_tmpSqlFilesTable'
   DROP TABLE #_tmpSqlFilesTable
END
CREATE TABLE #_tmpSqlFilesTable (ScriptIndex INT NOT NULL IDENTITY, SqlScriptContent NVARCHAR(MAX) NULL)

IF OBJECT_ID (N'#_vw_tmpSqlFilesTable', N'V') IS NOT NULL 
BEGIN
   PRINT 'View on temporary table exists already. Dropping view #_vw_tmpSqlFilesTable'
   DROP VIEW #_vw_tmpSqlFilesTable
END
CREATE VIEW #_vw_tmpSqlFilesTable AS SELECT t.SqlScriptContent from #_tmpSqlFilesTable t

DECLARE @_fileList NVARCHAR(MAX)
DECLARE @_fileName NVARCHAR(MAX)
DECLARE @_pos INT
DECLARE @_insertFileCommand NVARCHAR(MAX)

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
			SET @_insertFileCommand = 'BULK INSERT #_vw_tmpSqlFilesTable from ''' + @_fileName + ''' with (ROWTERMINATOR = ''\0'')'
			EXEC sp_executesql @_insertFileCommand
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
			SET @_insertFileCommand = 'BULK INSERT  #_vw_tmpSqlFilesTable from ''' + @_fileName + ''' with (ROWTERMINATOR = ''\0'')'
			EXEC sp_executesql @_insertFileCommand
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
SET @_lastAttemptsToKillSessions = $(_lastAttemptsToKillSessionsParam)
SET @_isHosted = $(_isHostedParam)

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
        
			SET @_statusMessage = ''

			IF @_isHosted = 1
			IF @_attempt <= @_acquireLockMaxAttempts - @_lastAttemptsToKillSessions
			BEGIN
				SELECT  TOP 1
						@_statusMessage = 'Longest running request holding application lock:' +
						'@attempt=' + CONVERT(VARCHAR(10), @_attempt) +                 
						'@spid=' + CONVERT(VARCHAR(10), l.request_session_id) +         
						'@oType=' + l.request_owner_type +                              
						'@mode=' + l.request_mode +                                     
						'@dbId=' + CONVERT(VARCHAR(10), l.resource_database_id) +       
						'@desc=' + REPLACE(RTRIM(l.resource_description), '@', ' ') +   
						'@status=' + a.status +                                         
						'@blkSpid=' + CONVERT(VARCHAR(10), a.blocking_session_id) +     
						'@startTime= ' + CONVERT(VARCHAR, a.start_time, 120) +          
						'@duration=' + CONVERT(VARCHAR(10), a.total_elapsed_time) +     
						'@hostName=' + s.host_name +                                    
						'@loginName=' + s.login_name +                                  
						'@content=' +
						CASE
							WHEN CHARINDEX('-- Hash:', t.text) > 0 THEN REPLACE(SUBSTRING(t.Text, CHARINDEX('-- Hash:', t.text) + 51, 255), '@', ' ') 
							ELSE REPLACE(SUBSTRING(t.text, 1, 255), '@', ' ')           
						END +                                                           
						'@stmt=' +
						CASE WHEN a.statement_end_offset IS NOT NULL
							THEN  REPLACE(SUBSTRING(t.text, 1 + a.statement_start_offset / 2, 255), '@', ' ')
							ELSE NULL
						END
				FROM	sys.dm_tran_locks l
				JOIN    sys.dm_exec_sessions  s WITH (NOLOCK)
				ON      l.request_session_id = s.session_id
				JOIN    sys.dm_exec_requests a WITH (NOLOCK)
				ON      l.request_session_id = a.session_id
				JOIN	sys.dm_exec_connections c WITH (NOLOCK)
				ON		l.request_session_id = c.session_id
				OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) t
				WHERE	l.resource_database_id = DB_ID()
				AND     l.request_status = 'GRANT'
				AND		l.resource_type = 'APPLICATION'
				AND     l.resource_description like '%[[]' + @_shortLockName + ']%'
				AND     a.total_elapsed_time > @_longRunningThresholdMilliSeconds            
				ORDER BY a.total_elapsed_time DESC
			END

			IF(@_statusMessage <> '')
			BEGIN
				RAISERROR('%s', 0, 231, @_statusMessage) WITH NOWAIT

				SET @_statusMessage = 'Servicing lock attempt ' + CONVERT(VARCHAR(10), @_attempt) + ' result: Long running request detected.'
				RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT
			END
			ELSE 
			BEGIN
				SET @_acquireLockStart = GETUTCDATE()
        
				SET @_statusMessage = 'Acquiring servicing lock: @attempt=' + CONVERT(VARCHAR(10), @_attempt) + '@timestamp=' + CONVERT(VARCHAR, GETUTCDATE(), 109)
				RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT

				if @_attempt = @_acquireLockMaxAttempts - @_lastAttemptsToKillSessions + 1
					SET @_acquireLockMilliseconds = @_acquireLockMilliseconds + 10 * 1000

				EXEC @_result = sp_getapplock  @Resource = @_acquireLock, @LockMode = 'Exclusive', @LockTimeout = @_acquireLockMilliseconds
       
				if @_result >= 0
					BREAK

				SET @_statusMessage = 'Servicing lock attempt ' + CONVERT(VARCHAR(10), @_attempt) + ' result: Timed out while acquiring the lock.'
				RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT
			END

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
        ROLLBACK
		DROP VIEW #_vw_tmpSqlFilesTable
		DROP TABLE #_tmpSqlFilesTable
		PRINT 'Failed to acquire exclusive lock. Dropping temporary table, view and rolling back.'
        RAISERROR('%%error="800070";%%:Failed to acquire an exclusive servicing lock', 16, -1)
        RETURN
    END

    SET @_statusMessage = 'Lock acquired:' + CONVERT(VARCHAR, GETUTCDATE(), 109) + ' time to acquire lock:' + CONVERT(VARCHAR, DateDiff(ms, @_acquireLockAttemptStart, GETUTCDATE()), 109) + ' ms'
    RAISERROR (@_statusMessage, 0, 231) WITH NOWAIT
END
PRINT 'Complete acquiring applock if specified'

PRINT 'Begin executing scripts'

DECLARE batchCursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT  SqlScriptContent
    FROM    #_tmpSqlFilesTable
	ORDER BY ScriptIndex ASC

OPEN batchCursor

FETCH   NEXT FROM batchCursor
INTO    @_batch

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @_batchStartTime = GETUTCDATE()
    SET @_batchMessage = '@b=' + '@bt=' + CONVERT(VARCHAR(25), @_batchStartTime, 21)
    RAISERROR (@_batchMessage, 0, 231)

    IF SERVERPROPERTY('Edition') <> 'SQL Azure'
    BEGIN
         SET @_batch = REPLACE(@_batch, ',MAX_GRANT_PERCENT=1', '/*,MAX_GRANT_PERCENT=1*/')
    END

    EXEC sp_ExecuteSql @_batch
    IF @@ERROR <> 0  
    BEGIN
        IF @_acquireLock <> '' 
        BEGIN
		    PRINT 'Script execution failed. Rolling back'
            ROLLBACK 
        END
		PRINT 'Dropping temporary table and view'
		DROP VIEW #_vw_tmpSqlFilesTable
		DROP TABLE #_tmpSqlFilesTable
        RETURN
    END

    FETCH   NEXT FROM batchCursor
    INTO    @_batch
END
SET @_batchMessage = '@b=' + '@bt=' + CONVERT(VARCHAR(25), GETUTCDATE(), 21)
RAISERROR (@_batchMessage, 0, 231)

CLOSE batchCursor
DEALLOCATE batchCursor
DROP VIEW #_vw_tmpSqlFilesTable
DROP TABLE #_tmpSqlFilesTable
PRINT 'Complete scripts execution. Temporary table and view dropped'

IF @_acquireLock <> ''

BEGIN
    COMMIT

    SET @_milliSecondsUnderLock = DATEDIFF(ms, @_acquireLockStart,  GETUTCDATE())
    
    if @_milliSecondsUnderLock >= 10000
        SET @_statusMessage = 'WARNING!! Time under lock exceeds 10 seconds - Time: ' + CONVERT(VARCHAR, @_milliSecondsUnderLock, 109) + ' ms'
    ELSE
        SET @_statusMessage = 'Time under lock: ' + CONVERT(VARCHAR, @_milliSecondsUnderLock, 109)  + ' ms'
    
    PRINT @_statusMessage 
END

IF @@TRANCOUNT > 0
BEGIN
	PRINT 'TRANSACTION EXECUTION FAILED'
    ROLLBACK
END