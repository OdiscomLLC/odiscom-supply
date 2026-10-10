/*
  Adds BOM/material upload metadata to the Azure SQL target.
  Binary files live in Azure Blob Storage or governed SharePoint libraries.
*/

CREATE TABLE commerce.MaterialUpload (
    MaterialUploadId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_MaterialUpload PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    CustomerId UNIQUEIDENTIFIER NULL,
    CustomerContactId UNIQUEIDENTIFIER NULL,
    SourceCompanyName NVARCHAR(250) NULL,
    SourceEmail NVARCHAR(320) NULL,
    FileName NVARCHAR(500) NOT NULL,
    StorageUri NVARCHAR(1200) NOT NULL,
    Notes NVARCHAR(MAX) NULL,
    Status NVARCHAR(60) NOT NULL DEFAULT 'new',
    UploadedByEntraObjectId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MaterialUpload_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId),
    CONSTRAINT FK_MaterialUpload_CustomerContact
        FOREIGN KEY (CustomerContactId)
        REFERENCES commerce.CustomerContact(CustomerContactId)
);
GO

CREATE INDEX IX_MaterialUpload_CustomerStatus
ON commerce.MaterialUpload (CustomerId, Status, CreatedAt DESC);
GO
