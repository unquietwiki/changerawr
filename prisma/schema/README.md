# Prisma Schema Organization

This directory contains the Prisma schema files organized by domain using Prisma's multi-file schema feature (GA in 6.7.0).

## File Structure

### `base.prisma`
Contains the fundamental configuration:
- Database datasource configuration
- Prisma Client generator configuration
- Output path specification

### `enums.prisma`
All enum type definitions:
- `Role` - User roles (ADMIN, STAFF, VIEWER)
- `TwoFactorMode` - Two-factor authentication modes
- `TelemetryState` - Telemetry consent states
- `ScheduledJobType` - Types of scheduled background jobs
- `JobStatus` - Status of scheduled jobs
- `RequestType` - Types of changelog requests
- `RequestStatus` - Status of requests
- `emailType` - Email notification types
- `SubscriptionType` - Subscription preferences

### `users.prisma`
User authentication and authorization:
- `User` - Core user model
- `RefreshToken` - JWT refresh token management
- `OAuthProvider` - OAuth provider configuration
- `OAuthConnection` - User OAuth connections
- `Settings` - User preferences and settings
- `Passkey` - WebAuthn passkey authentication
- `PasswordReset` - Password reset tokens
- `TwoFactorSession` - Two-factor authentication sessions
- `InvitationLink` - User invitation system
- `CliAuthCode` - CLI authentication codes

### `projects.prisma`
Project and changelog management:
- `Project` - Core project model
- `Changelog` - Project changelog container
- `ChangelogEntry` - Individual changelog entries
- `ChangelogTag` - Tags for categorizing entries
- `ChangelogRequest` - Approval workflow for changes
- `Widget` - Embeddable changelog widgets
- `CustomDomain` - Custom domain configuration

### `integrations.prisma`
Third-party service integrations:
- `EmailConfig` - SMTP email configuration
- `EmailLog` - Email send history
- `EmailSubscriber` - Email subscription management
- `ProjectSubscription` - Project-specific subscriptions
- `SlackIntegration` - Slack workspace integration
- `GitHubIntegration` - GitHub repository integration
- `ProjectSyncMetadata` - Git sync metadata
- `SyncedCommit` - Synced commit history

### `system.prisma`
System-level configuration and management:
- `ApiKey` - API key management (global and project-scoped)
- `AuditLog` - System audit trail
- `SystemConfig` - Global system configuration
- `PublicChangelogAnalytics` - Public changelog view analytics
- `ScheduledJob` - Background job scheduling

## Adding New Models

When adding new models:

1. Determine the appropriate domain file
2. If creating a new domain, create a new `.prisma` file
3. Ensure all references to other models are valid
4. Run `npx prisma format` to validate syntax
5. Run `npx prisma generate` to update the client
6. Create and apply migrations as needed

## Benefits of This Structure

- **Improved Maintainability**: Each file focuses on a specific domain
- **Better Collaboration**: Reduces merge conflicts when multiple developers work on schema
- **Easier Navigation**: Find models quickly based on domain
- **Clear Organization**: Domain boundaries are explicit
- **Scalability**: Easy to add new domains as the application grows

## Schema Validation

To validate the entire schema:
```bash
npx prisma format
npx prisma validate
```

## Generating Client

The Prisma Client is automatically generated from all schema files:
```bash
npx prisma generate
```

## Migrations

Migrations work the same way with multi-file schemas:
```bash
npx prisma migrate dev --name description_of_change
npx prisma migrate deploy
```
