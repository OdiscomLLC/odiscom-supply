/*
  Odiscom Supply migration control schema.
  Persists migration-run evidence and one-time source-to-target mappings.

  This prevents generated target IDs from changing between rehearsals and gives
  the cutover an auditable record of what moved.
*/

IF SCHEMA_ID('migration') IS NULL EXEC('CREATE SCHEMA migration');
GO

CREATE TABLE migration.MigrationRun (
    MigrationRunId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_MigrationRun PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    RunType NVARCHAR(30) NOT NULL,
    SourceSystem NVARCHAR(100) NOT NULL DEFAULT 'supabase',
    TargetSystem NVARCHAR(100) NOT NULL DEFAULT 'azure-sql',
    SourceSnapshotAt DATETIME2(3) NULL,
    StartedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2(3) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'running',
    SourceManifestHash CHAR(64) NULL,
    TargetManifestHash CHAR(64) NULL,
    Notes NVARCHAR(MAX) NULL,
    CONSTRAINT CK_MigrationRun_RunType
        CHECK (RunType IN ('rehearsal','cutover','repair')),
    CONSTRAINT CK_MigrationRun_Status
        CHECK (Status IN ('running','passed','failed','cancelled'))
);
GO

CREATE TABLE migration.SourceRecordMap (
    SourceRecordMapId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SourceRecordMap PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SourceSystem NVARCHAR(100) NOT NULL DEFAULT 'supabase',
    SourceEntity NVARCHAR(100) NOT NULL,
    SourceKey NVARCHAR(500) NOT NULL,
    TargetEntity NVARCHAR(100) NOT NULL,
    TargetId UNIQUEIDENTIFIER NOT NULL,
    MappingReason NVARCHAR(250) NULL,
    IsGeneratedTargetId BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_SourceRecordMap_Source UNIQUE (SourceSystem, SourceEntity, SourceKey),
    CONSTRAINT UQ_SourceRecordMap_Target UNIQUE (TargetEntity, TargetId)
);
GO

CREATE TABLE migration.ReconciliationMetric (
    ReconciliationMetricId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_ReconciliationMetric PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    MigrationRunId UNIQUEIDENTIFIER NOT NULL,
    DomainName NVARCHAR(100) NOT NULL,
    MetricName NVARCHAR(150) NOT NULL,
    SourceValue NVARCHAR(500) NULL,
    TargetValue NVARCHAR(500) NULL,
    Passed BIT NOT NULL,
    Detail NVARCHAR(MAX) NULL,
    RecordedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ReconciliationMetric_Run
        FOREIGN KEY (MigrationRunId)
        REFERENCES migration.MigrationRun(MigrationRunId)
);
GO

CREATE INDEX IX_ReconciliationMetric_RunDomain
ON migration.ReconciliationMetric (MigrationRunId, DomainName, Passed);
GO

CREATE TABLE migration.FileReconciliation (
    FileReconciliationId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FileReconciliation PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    MigrationRunId UNIQUEIDENTIFIER NOT NULL,
    SourceEntity NVARCHAR(100) NOT NULL,
    SourceRecordKey NVARCHAR(500) NOT NULL,
    SourceUri NVARCHAR(1500) NULL,
    TargetUri NVARCHAR(1500) NULL,
    SourceSizeBytes BIGINT NULL,
    TargetSizeBytes BIGINT NULL,
    SourceSha256 CHAR(64) NULL,
    TargetSha256 CHAR(64) NULL,
    Passed BIT NOT NULL DEFAULT 0,
    Detail NVARCHAR(MAX) NULL,
    RecordedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_FileReconciliation_Run
        FOREIGN KEY (MigrationRunId)
        REFERENCES migration.MigrationRun(MigrationRunId)
);
GO

CREATE INDEX IX_FileReconciliation_RunPassed
ON migration.FileReconciliation (MigrationRunId, Passed);
GO
