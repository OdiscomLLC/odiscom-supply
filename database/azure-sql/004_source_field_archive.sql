/*
  Preserves legacy source fields that do not have a direct first-class target column.
  This prevents migration data loss without polluting the normalized production model.
*/

CREATE TABLE migration.SourceFieldArchive (
    SourceFieldArchiveId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SourceFieldArchive PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    MigrationRunId UNIQUEIDENTIFIER NULL,
    SourceSystem NVARCHAR(100) NOT NULL DEFAULT 'supabase',
    SourceEntity NVARCHAR(100) NOT NULL,
    SourceRecordKey NVARCHAR(500) NOT NULL,
    FieldName NVARCHAR(200) NOT NULL,
    JsonValue NVARCHAR(MAX) NULL,
    ArchiveReason NVARCHAR(500) NULL,
    RecordedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SourceFieldArchive_Run
        FOREIGN KEY (MigrationRunId)
        REFERENCES migration.MigrationRun(MigrationRunId),
    CONSTRAINT CK_SourceFieldArchive_JsonValue
        CHECK (JsonValue IS NULL OR ISJSON(JsonValue) = 1)
);
GO

CREATE INDEX IX_SourceFieldArchive_Record
ON migration.SourceFieldArchive (SourceEntity, SourceRecordKey, FieldName);
GO
