/*
  Odiscom Supply LLC
  Azure SQL v1 core schema
  Target: Microsoft-native production platform

  Notes:
  - Legal/company boundary: Odiscom Supply owns this database.
  - Odiscom LLC is represented as a customer organization, not as an internal owner.
  - Microsoft Entra object IDs are identity references; email is not the authorization key.
  - JSON payloads are stored as NVARCHAR(MAX) with ISJSON checks where flexible source data is required.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID('identity') IS NULL EXEC('CREATE SCHEMA identity');
IF SCHEMA_ID('catalog') IS NULL EXEC('CREATE SCHEMA catalog');
IF SCHEMA_ID('sourcing') IS NULL EXEC('CREATE SCHEMA sourcing');
IF SCHEMA_ID('commerce') IS NULL EXEC('CREATE SCHEMA commerce');
IF SCHEMA_ID('ops') IS NULL EXEC('CREATE SCHEMA ops');
GO

CREATE TABLE identity.ExternalOrganization (
    ExternalOrganizationId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_ExternalOrganization PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OrganizationType NVARCHAR(30) NOT NULL,
    LegalName NVARCHAR(250) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    EntraExternalTenantId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ExternalOrganization_Type CHECK (OrganizationType IN ('customer','supplier'))
);
GO

CREATE TABLE identity.ExternalOrganizationMember (
    ExternalOrganizationMemberId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_ExternalOrganizationMember PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ExternalOrganizationId UNIQUEIDENTIFIER NOT NULL,
    EntraObjectId UNIQUEIDENTIFIER NOT NULL,
    Email NVARCHAR(320) NULL,
    DisplayName NVARCHAR(250) NULL,
    MemberRole NVARCHAR(60) NOT NULL DEFAULT 'member',
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ExternalOrganizationMember_Organization
        FOREIGN KEY (ExternalOrganizationId)
        REFERENCES identity.ExternalOrganization(ExternalOrganizationId),
    CONSTRAINT UQ_ExternalOrganizationMember UNIQUE (ExternalOrganizationId, EntraObjectId)
);
GO

CREATE TABLE identity.InternalRoleAssignment (
    InternalRoleAssignmentId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_InternalRoleAssignment PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    EntraObjectId UNIQUEIDENTIFIER NOT NULL,
    PrincipalType NVARCHAR(20) NOT NULL DEFAULT 'user',
    RoleName NVARCHAR(80) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_InternalRoleAssignment_PrincipalType CHECK (PrincipalType IN ('user','group')),
    CONSTRAINT UQ_InternalRoleAssignment UNIQUE (EntraObjectId, RoleName)
);
GO

CREATE TABLE catalog.Manufacturer (
    ManufacturerId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Manufacturer PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(250) NOT NULL,
    ManufacturerKey NVARCHAR(250) NOT NULL,
    Website NVARCHAR(500) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Manufacturer_Key UNIQUE (ManufacturerKey)
);
GO

CREATE TABLE catalog.Product (
    ProductId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Product PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ManufacturerId UNIQUEIDENTIFIER NOT NULL,
    ManufacturerPartNumber NVARCHAR(250) NOT NULL,
    MpnKey NVARCHAR(250) NOT NULL,
    Sku NVARCHAR(250) NULL,
    Slug NVARCHAR(300) NULL,
    Name NVARCHAR(500) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Category NVARCHAR(250) NULL,
    Unit NVARCHAR(50) NULL,
    Upc NVARCHAR(100) NULL,
    CountryOfOrigin NVARCHAR(100) NULL,
    TaaCompliant BIT NULL,
    BabaCompliant BIT NULL,
    ImageUrl NVARCHAR(1000) NULL,
    SpecSheetUrl NVARCHAR(1000) NULL,
    SpecificationsJson NVARCHAR(MAX) NULL,
    CatalogOrigin NVARCHAR(100) NULL,
    SourcingStatus NVARCHAR(60) NULL,
    PublicationStatus NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Product_Manufacturer
        FOREIGN KEY (ManufacturerId)
        REFERENCES catalog.Manufacturer(ManufacturerId),
    CONSTRAINT CK_Product_SpecificationsJson
        CHECK (SpecificationsJson IS NULL OR ISJSON(SpecificationsJson) = 1),
    CONSTRAINT UQ_Product_ManufacturerMpn UNIQUE (ManufacturerId, MpnKey)
);
GO

CREATE INDEX IX_Product_PublicationStatus
ON catalog.Product (PublicationStatus, Category);
GO

CREATE TABLE catalog.ProductDocument (
    ProductDocumentId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_ProductDocument PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ProductId UNIQUEIDENTIFIER NOT NULL,
    DocumentType NVARCHAR(60) NOT NULL,
    FileName NVARCHAR(500) NULL,
    StorageUri NVARCHAR(1200) NOT NULL,
    Visibility NVARCHAR(30) NOT NULL DEFAULT 'public',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductDocument_Product
        FOREIGN KEY (ProductId)
        REFERENCES catalog.Product(ProductId)
);
GO

CREATE TABLE sourcing.Supplier (
    SupplierId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Supplier PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ExternalOrganizationId UNIQUEIDENTIFIER NULL,
    LegalName NVARCHAR(250) NOT NULL,
    DisplayName NVARCHAR(250) NOT NULL,
    Website NVARCHAR(500) NULL,
    Phone NVARCHAR(80) NULL,
    ProductCategories NVARCHAR(MAX) NULL,
    Brands NVARCHAR(MAX) NULL,
    PaymentTerms NVARCHAR(250) NULL,
    DefaultLeadTime NVARCHAR(250) NULL,
    ApprovalStatus NVARCHAR(30) NOT NULL DEFAULT 'pending',
    OnboardingStatus NVARCHAR(30) NOT NULL DEFAULT 'new',
    Priority NVARCHAR(30) NULL,
    NextAction NVARCHAR(1000) NULL,
    ResaleCertificateStatus NVARCHAR(60) NULL,
    CreditStatus NVARCHAR(60) NULL,
    AccountNumber NVARCHAR(250) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Supplier_ExternalOrganization
        FOREIGN KEY (ExternalOrganizationId)
        REFERENCES identity.ExternalOrganization(ExternalOrganizationId)
);
GO

CREATE UNIQUE INDEX UX_Supplier_ExternalOrganization
ON sourcing.Supplier (ExternalOrganizationId)
WHERE ExternalOrganizationId IS NOT NULL;
GO

CREATE TABLE sourcing.SupplierContact (
    SupplierContactId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SupplierContact PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SupplierId UNIQUEIDENTIFIER NOT NULL,
    ContactName NVARCHAR(250) NULL,
    Email NVARCHAR(320) NULL,
    Phone NVARCHAR(80) NULL,
    RoleTitle NVARCHAR(250) NULL,
    IsPrimary BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SupplierContact_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE TABLE sourcing.SupplierCatalogSource (
    SupplierCatalogSourceId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SupplierCatalogSource PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SupplierId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(250) NOT NULL,
    SourceType NVARCHAR(60) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'paused',
    CredentialReference NVARCHAR(500) NULL,
    EndpointUrl NVARCHAR(1000) NULL,
    FieldMappingJson NVARCHAR(MAX) NULL,
    SyncSettingsJson NVARCHAR(MAX) NULL,
    LastSyncAt DATETIME2(3) NULL,
    LastSuccessAt DATETIME2(3) NULL,
    LastErrorAt DATETIME2(3) NULL,
    LastError NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SupplierCatalogSource_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId),
    CONSTRAINT CK_SupplierCatalogSource_FieldMappingJson
        CHECK (FieldMappingJson IS NULL OR ISJSON(FieldMappingJson) = 1),
    CONSTRAINT CK_SupplierCatalogSource_SyncSettingsJson
        CHECK (SyncSettingsJson IS NULL OR ISJSON(SyncSettingsJson) = 1)
);
GO

CREATE TABLE sourcing.SupplierOffer (
    SupplierOfferId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SupplierOffer PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SupplierId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NOT NULL,
    SupplierCatalogSourceId UNIQUEIDENTIFIER NULL,
    SupplierSku NVARCHAR(250) NULL,
    OfferKey NVARCHAR(500) NOT NULL,
    ChannelType NVARCHAR(80) NULL,
    UnitCost DECIMAL(19,4) NULL,
    Currency CHAR(3) NOT NULL DEFAULT 'USD',
    AvailableQuantity DECIMAL(19,4) NULL,
    AvailabilityStatus NVARCHAR(60) NULL,
    LeadTimeDays INT NULL,
    LeadTimeText NVARCHAR(250) NULL,
    MinimumOrderQuantity DECIMAL(19,4) NULL,
    PriceBreaksJson NVARCHAR(MAX) NULL,
    FreightTerms NVARCHAR(500) NULL,
    ManufacturerAuthorized BIT NULL,
    QuoteRequired BIT NOT NULL DEFAULT 0,
    ValidUntil DATETIME2(3) NULL,
    SourceUpdatedAt DATETIME2(3) NULL,
    LastSeenAt DATETIME2(3) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    ReviewStatus NVARCHAR(30) NOT NULL DEFAULT 'pending',
    SubmittedByEntraObjectId UNIQUEIDENTIFIER NULL,
    ReviewedAt DATETIME2(3) NULL,
    ReviewNotes NVARCHAR(MAX) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SupplierOffer_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId),
    CONSTRAINT FK_SupplierOffer_Product
        FOREIGN KEY (ProductId)
        REFERENCES catalog.Product(ProductId),
    CONSTRAINT FK_SupplierOffer_Source
        FOREIGN KEY (SupplierCatalogSourceId)
        REFERENCES sourcing.SupplierCatalogSource(SupplierCatalogSourceId),
    CONSTRAINT CK_SupplierOffer_PriceBreaksJson
        CHECK (PriceBreaksJson IS NULL OR ISJSON(PriceBreaksJson) = 1),
    CONSTRAINT UQ_SupplierOffer_Key UNIQUE (SupplierId, OfferKey)
);
GO

CREATE INDEX IX_SupplierOffer_ProductEligibility
ON sourcing.SupplierOffer (ProductId, IsActive, ReviewStatus, LastSeenAt);
GO

CREATE TABLE sourcing.SupplierImportJob (
    SupplierImportJobId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SupplierImportJob PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SupplierCatalogSourceId UNIQUEIDENTIFIER NULL,
    SupplierId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    FileName NVARCHAR(500) NULL,
    StorageUri NVARCHAR(1200) NULL,
    SourceReference NVARCHAR(1000) NULL,
    RowCount INT NOT NULL DEFAULT 0,
    MatchedCount INT NOT NULL DEFAULT 0,
    CreatedProductCount INT NOT NULL DEFAULT 0,
    UpdatedOfferCount INT NOT NULL DEFAULT 0,
    ReviewCount INT NOT NULL DEFAULT 0,
    RejectedCount INT NOT NULL DEFAULT 0,
    ErrorSummary NVARCHAR(MAX) NULL,
    CreatedByEntraObjectId UNIQUEIDENTIFIER NULL,
    StartedAt DATETIME2(3) NULL,
    CompletedAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SupplierImportJob_Source
        FOREIGN KEY (SupplierCatalogSourceId)
        REFERENCES sourcing.SupplierCatalogSource(SupplierCatalogSourceId),
    CONSTRAINT FK_SupplierImportJob_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE TABLE sourcing.SupplierImportRow (
    SupplierImportRowId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SupplierImportRow PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SupplierImportJobId UNIQUEIDENTIFIER NOT NULL,
    RowNumber INT NOT NULL,
    SupplierSku NVARCHAR(250) NULL,
    Manufacturer NVARCHAR(250) NULL,
    ManufacturerPartNumber NVARCHAR(250) NULL,
    ProductName NVARCHAR(500) NULL,
    UnitCost DECIMAL(19,4) NULL,
    Currency CHAR(3) NULL,
    AvailableQuantity DECIMAL(19,4) NULL,
    AvailabilityStatus NVARCHAR(60) NULL,
    LeadTimeDays INT NULL,
    LeadTimeText NVARCHAR(250) NULL,
    MinimumOrderQuantity DECIMAL(19,4) NULL,
    PriceBreaksJson NVARCHAR(MAX) NULL,
    CountryOfOrigin NVARCHAR(100) NULL,
    TaaCompliant BIT NULL,
    BabaCompliant BIT NULL,
    MatchStatus NVARCHAR(60) NULL,
    MatchedProductId UNIQUEIDENTIFIER NULL,
    ValidationErrorsJson NVARCHAR(MAX) NULL,
    RawDataJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SupplierImportRow_Job
        FOREIGN KEY (SupplierImportJobId)
        REFERENCES sourcing.SupplierImportJob(SupplierImportJobId),
    CONSTRAINT FK_SupplierImportRow_Product
        FOREIGN KEY (MatchedProductId)
        REFERENCES catalog.Product(ProductId),
    CONSTRAINT CK_SupplierImportRow_PriceBreaksJson
        CHECK (PriceBreaksJson IS NULL OR ISJSON(PriceBreaksJson) = 1),
    CONSTRAINT CK_SupplierImportRow_ValidationErrorsJson
        CHECK (ValidationErrorsJson IS NULL OR ISJSON(ValidationErrorsJson) = 1),
    CONSTRAINT CK_SupplierImportRow_RawDataJson
        CHECK (RawDataJson IS NULL OR ISJSON(RawDataJson) = 1),
    CONSTRAINT UQ_SupplierImportRow UNIQUE (SupplierImportJobId, RowNumber)
);
GO

CREATE TABLE commerce.Customer (
    CustomerId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Customer PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ExternalOrganizationId UNIQUEIDENTIFIER NULL,
    LegalName NVARCHAR(250) NOT NULL,
    DisplayName NVARCHAR(250) NOT NULL,
    AccountStatus NVARCHAR(30) NOT NULL DEFAULT 'active',
    PricingTier NVARCHAR(60) NULL,
    TaxStatus NVARCHAR(60) NULL,
    PaymentPreference NVARCHAR(60) NULL,
    FreightPreference NVARCHAR(60) NULL,
    PoRequired BIT NOT NULL DEFAULT 0,
    IsRelatedCompany BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Customer_ExternalOrganization
        FOREIGN KEY (ExternalOrganizationId)
        REFERENCES identity.ExternalOrganization(ExternalOrganizationId)
);
GO

CREATE UNIQUE INDEX UX_Customer_ExternalOrganization
ON commerce.Customer (ExternalOrganizationId)
WHERE ExternalOrganizationId IS NOT NULL;
GO

CREATE TABLE commerce.CustomerContact (
    CustomerContactId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_CustomerContact PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    CustomerId UNIQUEIDENTIFIER NOT NULL,
    ContactName NVARCHAR(250) NULL,
    Email NVARCHAR(320) NULL,
    Phone NVARCHAR(80) NULL,
    RoleTitle NVARCHAR(250) NULL,
    IsPrimary BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CustomerContact_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId)
);
GO

CREATE TABLE commerce.CustomerLocation (
    CustomerLocationId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_CustomerLocation PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    CustomerId UNIQUEIDENTIFIER NOT NULL,
    LocationName NVARCHAR(250) NULL,
    AddressLine1 NVARCHAR(250) NULL,
    AddressLine2 NVARCHAR(250) NULL,
    City NVARCHAR(150) NULL,
    StateProvince NVARCHAR(100) NULL,
    PostalCode NVARCHAR(30) NULL,
    Country NVARCHAR(100) NOT NULL DEFAULT 'United States',
    IsDefaultShipTo BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CustomerLocation_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId)
);
GO

CREATE TABLE commerce.CustomerDocument (
    CustomerDocumentId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_CustomerDocument PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    CustomerId UNIQUEIDENTIFIER NOT NULL,
    DocumentType NVARCHAR(80) NOT NULL,
    FileName NVARCHAR(500) NOT NULL,
    StorageUri NVARCHAR(1200) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    Visibility NVARCHAR(30) NOT NULL DEFAULT 'customer',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CustomerDocument_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId)
);
GO

CREATE TABLE commerce.Quote (
    QuoteId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Quote PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    QuoteNumber NVARCHAR(80) NOT NULL,
    CustomerId UNIQUEIDENTIFIER NOT NULL,
    CustomerContactId UNIQUEIDENTIFIER NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'new',
    Priority NVARCHAR(30) NULL,
    Source NVARCHAR(80) NULL,
    CustomerReference NVARCHAR(250) NULL,
    Details NVARCHAR(MAX) NULL,
    InternalNotes NVARCHAR(MAX) NULL,
    AssignedToEntraObjectId UNIQUEIDENTIFIER NULL,
    AcceptanceToken UNIQUEIDENTIFIER NULL,
    QuotedAt DATETIME2(3) NULL,
    AcceptedAt DATETIME2(3) NULL,
    ValidUntil DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Quote_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId),
    CONSTRAINT FK_Quote_CustomerContact
        FOREIGN KEY (CustomerContactId)
        REFERENCES commerce.CustomerContact(CustomerContactId),
    CONSTRAINT UQ_Quote_QuoteNumber UNIQUE (QuoteNumber)
);
GO

CREATE TABLE commerce.QuoteItem (
    QuoteItemId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_QuoteItem PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    QuoteId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NULL,
    ProductName NVARCHAR(500) NOT NULL,
    ManufacturerPartNumber NVARCHAR(250) NULL,
    Quantity DECIMAL(19,4) NOT NULL,
    Unit NVARCHAR(50) NULL,
    UnitPrice DECIMAL(19,4) NULL,
    UnitCost DECIMAL(19,4) NULL,
    TotalPrice DECIMAL(19,4) NULL,
    SupplierId UNIQUEIDENTIFIER NULL,
    CostConfirmed BIT NOT NULL DEFAULT 0,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_QuoteItem_Quote
        FOREIGN KEY (QuoteId)
        REFERENCES commerce.Quote(QuoteId),
    CONSTRAINT FK_QuoteItem_Product
        FOREIGN KEY (ProductId)
        REFERENCES catalog.Product(ProductId),
    CONSTRAINT FK_QuoteItem_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE TABLE commerce.SalesOrder (
    SalesOrderId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SalesOrder PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    QuoteId UNIQUEIDENTIFIER NULL,
    OrderNumber NVARCHAR(80) NOT NULL,
    CustomerId UNIQUEIDENTIFIER NOT NULL,
    CustomerContactId UNIQUEIDENTIFIER NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'new',
    Total DECIMAL(19,4) NULL,
    PaymentMethod NVARCHAR(60) NULL,
    PaymentStatus NVARCHAR(60) NULL,
    PoNumber NVARCHAR(250) NULL,
    CustomerReference NVARCHAR(250) NULL,
    FreightPreference NVARCHAR(60) NULL,
    CustomerLocationId UNIQUEIDENTIFIER NULL,
    FulfillmentStatus NVARCHAR(60) NULL,
    ExpectedDelivery DATE NULL,
    ShippedAt DATETIME2(3) NULL,
    DeliveredAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SalesOrder_Quote
        FOREIGN KEY (QuoteId)
        REFERENCES commerce.Quote(QuoteId),
    CONSTRAINT FK_SalesOrder_Customer
        FOREIGN KEY (CustomerId)
        REFERENCES commerce.Customer(CustomerId),
    CONSTRAINT FK_SalesOrder_CustomerContact
        FOREIGN KEY (CustomerContactId)
        REFERENCES commerce.CustomerContact(CustomerContactId),
    CONSTRAINT FK_SalesOrder_CustomerLocation
        FOREIGN KEY (CustomerLocationId)
        REFERENCES commerce.CustomerLocation(CustomerLocationId),
    CONSTRAINT UQ_SalesOrder_OrderNumber UNIQUE (OrderNumber)
);
GO

CREATE TABLE commerce.SalesOrderItem (
    SalesOrderItemId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SalesOrderItem PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SalesOrderId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NULL,
    ProductName NVARCHAR(500) NOT NULL,
    Quantity DECIMAL(19,4) NOT NULL,
    UnitPrice DECIMAL(19,4) NULL,
    UnitCost DECIMAL(19,4) NULL,
    TotalPrice DECIMAL(19,4) NULL,
    SupplierId UNIQUEIDENTIFIER NULL,
    CostConfirmed BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SalesOrderItem_Order
        FOREIGN KEY (SalesOrderId)
        REFERENCES commerce.SalesOrder(SalesOrderId),
    CONSTRAINT FK_SalesOrderItem_Product
        FOREIGN KEY (ProductId)
        REFERENCES catalog.Product(ProductId),
    CONSTRAINT FK_SalesOrderItem_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE TABLE commerce.OrderEvent (
    OrderEventId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_OrderEvent PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SalesOrderId UNIQUEIDENTIFIER NOT NULL,
    EventType NVARCHAR(80) NOT NULL,
    Title NVARCHAR(250) NOT NULL,
    Detail NVARCHAR(MAX) NULL,
    Visibility NVARCHAR(30) NOT NULL DEFAULT 'internal',
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedByEntraObjectId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_OrderEvent_Order
        FOREIGN KEY (SalesOrderId)
        REFERENCES commerce.SalesOrder(SalesOrderId),
    CONSTRAINT CK_OrderEvent_MetadataJson
        CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
);
GO

CREATE TABLE commerce.PaymentReference (
    PaymentReferenceId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_PaymentReference PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SalesOrderId UNIQUEIDENTIFIER NOT NULL,
    Provider NVARCHAR(80) NOT NULL,
    ProviderReference NVARCHAR(500) NOT NULL,
    PaymentMethod NVARCHAR(60) NULL,
    Status NVARCHAR(60) NULL,
    Amount DECIMAL(19,4) NULL,
    Currency CHAR(3) NOT NULL DEFAULT 'USD',
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PaymentReference_Order
        FOREIGN KEY (SalesOrderId)
        REFERENCES commerce.SalesOrder(SalesOrderId)
);
GO

CREATE TABLE commerce.Shipment (
    ShipmentId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Shipment PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SalesOrderId UNIQUEIDENTIFIER NOT NULL,
    Carrier NVARCHAR(120) NULL,
    TrackingNumber NVARCHAR(250) NULL,
    TrackingUrl NVARCHAR(1000) NULL,
    Status NVARCHAR(60) NULL,
    ExpectedDelivery DATE NULL,
    ShippedAt DATETIME2(3) NULL,
    DeliveredAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Shipment_Order
        FOREIGN KEY (SalesOrderId)
        REFERENCES commerce.SalesOrder(SalesOrderId)
);
GO

CREATE TABLE ops.HardwareOpportunity (
    HardwareOpportunityId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_HardwareOpportunity PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SolicitationNumber NVARCHAR(250) NULL,
    Title NVARCHAR(1000) NOT NULL,
    Agency NVARCHAR(500) NULL,
    ContractingOffice NVARCHAR(500) NULL,
    NoticeType NVARCHAR(120) NULL,
    Naics NVARCHAR(60) NULL,
    Psc NVARCHAR(60) NULL,
    SetAside NVARCHAR(250) NULL,
    PostedAt DATETIME2(3) NULL,
    ResponseDeadline DATETIME2(3) NULL,
    SourceUrl NVARCHAR(1200) NULL,
    DeliveryLocations NVARCHAR(MAX) NULL,
    ScopeSummary NVARCHAR(MAX) NULL,
    BiddingEntity NVARCHAR(250) NULL,
    Stage NVARCHAR(60) NULL,
    Priority NVARCHAR(30) NULL,
    FitScore INT NULL,
    EstimatedValue DECIMAL(19,2) NULL,
    TargetRevenue DECIMAL(19,2) NULL,
    EstimatedCost DECIMAL(19,2) NULL,
    AssignedToEntraObjectId UNIQUEIDENTIFIER NULL,
    NextAction NVARCHAR(1000) NULL,
    NextActionDue DATE NULL,
    SubmissionMethod NVARCHAR(250) NULL,
    SubmissionContact NVARCHAR(500) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE ops.HardwareOpportunityItem (
    HardwareOpportunityItemId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_HardwareOpportunityItem PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    HardwareOpportunityId UNIQUEIDENTIFIER NOT NULL,
    LineNumber NVARCHAR(100) NULL,
    ClinNumber NVARCHAR(100) NULL,
    SiteName NVARCHAR(250) NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Quantity DECIMAL(19,4) NULL,
    Unit NVARCHAR(80) NULL,
    PreferredManufacturer NVARCHAR(250) NULL,
    PreferredPartNumber NVARCHAR(250) NULL,
    BrandNameOrEqual BIT NULL,
    TaaRequired BIT NULL,
    BabaRequired BIT NULL,
    DomesticSourceRequired BIT NULL,
    BestSupplierId UNIQUEIDENTIFIER NULL,
    UnitCost DECIMAL(19,4) NULL,
    FreightAllocation DECIMAL(19,4) NULL,
    SellUnitPrice DECIMAL(19,4) NULL,
    LeadTime NVARCHAR(250) NULL,
    ComplianceNotes NVARCHAR(MAX) NULL,
    DeliveryDate DATE NULL,
    QuantityStatus NVARCHAR(60) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_HardwareOpportunityItem_Opportunity
        FOREIGN KEY (HardwareOpportunityId)
        REFERENCES ops.HardwareOpportunity(HardwareOpportunityId),
    CONSTRAINT FK_HardwareOpportunityItem_Supplier
        FOREIGN KEY (BestSupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE TABLE ops.OpportunitySupplierQuote (
    OpportunitySupplierQuoteId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_OpportunitySupplierQuote PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    HardwareOpportunityId UNIQUEIDENTIFIER NOT NULL,
    SupplierId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(60) NULL,
    RfqSentAt DATETIME2(3) NULL,
    ResponseDueAt DATETIME2(3) NULL,
    ReceivedAt DATETIME2(3) NULL,
    ValidityExpiresAt DATE NULL,
    MaterialCost DECIMAL(19,4) NULL,
    FreightCost DECIMAL(19,4) NULL,
    OtherCost DECIMAL(19,4) NULL,
    SellPrice DECIMAL(19,4) NULL,
    LeadTime NVARCHAR(250) NULL,
    ComplianceStatus NVARCHAR(80) NULL,
    DomesticStatus NVARCHAR(80) NULL,
    QuoteReference NVARCHAR(250) NULL,
    QuoteUri NVARCHAR(1200) NULL,
    ContactName NVARCHAR(250) NULL,
    ContactEmail NVARCHAR(320) NULL,
    CostsConfirmed BIT NOT NULL DEFAULT 0,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_OpportunitySupplierQuote_Opportunity
        FOREIGN KEY (HardwareOpportunityId)
        REFERENCES ops.HardwareOpportunity(HardwareOpportunityId),
    CONSTRAINT FK_OpportunitySupplierQuote_Supplier
        FOREIGN KEY (SupplierId)
        REFERENCES sourcing.Supplier(SupplierId)
);
GO

CREATE INDEX IX_Quote_Customer_Status
ON commerce.Quote (CustomerId, Status, CreatedAt DESC);
GO

CREATE INDEX IX_SalesOrder_Customer_Status
ON commerce.SalesOrder (CustomerId, Status, CreatedAt DESC);
GO

CREATE INDEX IX_HardwareOpportunity_StageDeadline
ON ops.HardwareOpportunity (Stage, ResponseDeadline);
GO
