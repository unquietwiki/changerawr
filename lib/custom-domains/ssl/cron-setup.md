# SSL Auto-Renewal Cron Setup

This document explains how to set up automatic SSL certificate renewal using cron jobs.

## Overview

The auto-renewal system checks for certificates expiring within 30 days and automatically renews them. This prevents service disruptions from expired certificates.

## Cron Job Configuration

### Option 1: System Cron (Linux/macOS)

Add this to your crontab (`crontab -e`):

```bash
# Run SSL auto-renewal every day at 3 AM
0 3 * * * curl -X POST https://your-domain.com/api/cron/ssl-renewal -H "Authorization: Bearer YOUR_INTERNAL_API_SECRET" >> /var/log/ssl-renewal.log 2>&1
```

### Option 2: Docker Cron Container

Create a separate container that runs the cron job:

**docker-compose.yml:**
```yaml
services:
  ssl-renewal-cron:
    image: alpine:latest
    command: >
      sh -c "echo '0 3 * * * wget --header=\"Authorization: Bearer $$INTERNAL_API_SECRET\" --post-data=\"\" https://your-domain.com/api/cron/ssl-renewal -O - >> /var/log/ssl-renewal.log 2>&1' | crontab - && crond -f"
    environment:
      - INTERNAL_API_SECRET=${INTERNAL_API_SECRET}
    volumes:
      - ./logs:/var/log
    restart: unless-stopped
```

### Option 3: External Cron Service

Use a service like:
- **Cron-job.org** - Free web-based cron service
- **EasyCron** - Scheduled HTTP requests
- **GitHub Actions** - Scheduled workflows

**Example GitHub Action (.github/workflows/ssl-renewal.yml):**
```yaml
name: SSL Auto-Renewal
on:
  schedule:
    - cron: '0 3 * * *' # Daily at 3 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  renew:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger SSL Renewal
        run: |
          curl -X POST https://your-domain.com/api/cron/ssl-renewal \
            -H "Authorization: Bearer ${{ secrets.INTERNAL_API_SECRET }}"
```

### Option 4: Vercel Cron (Vercel Deployments)

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/ssl-renewal",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Note: You'll need to modify the API route to check for Vercel's cron secret instead of the Authorization header.

## Monitoring

### Check Certificate Health

```bash
curl -H "Authorization: Bearer YOUR_INTERNAL_API_SECRET" \
  "https://your-domain.com/api/cron/ssl-renewal?action=health"
```

Response:
```json
{
  "success": true,
  "health": {
    "total": 45,
    "issued": 42,
    "expiringSoon": 5,
    "expired": 0,
    "pending": 2,
    "failed": 1
  }
}
```

### Manual Renewal Trigger

```bash
curl -X POST -H "Authorization: Bearer YOUR_INTERNAL_API_SECRET" \
  https://your-domain.com/api/cron/ssl-renewal
```

Response:
```json
{
  "success": true,
  "result": {
    "checked": 5,
    "renewed": 4,
    "failed": 1,
    "errors": [
      {
        "domain": "example.com",
        "error": "DNS-01 certificate requires manual renewal"
      }
    ]
  }
}
```

## Configuration

### Environment Variables

```bash
# Required: Secret for authenticating cron jobs
INTERNAL_API_SECRET=your-random-secret-here

# Optional: Customize renewal threshold (default: 30 days)
SSL_RENEWAL_THRESHOLD_DAYS=30

# Optional: Maximum certificates to process per run (default: 10)
SSL_RENEWAL_BATCH_SIZE=10
```

## How It Works

1. **Daily Check**: Cron job runs daily (recommended: 3 AM)
2. **Find Expiring**: Queries database for certificates expiring within 30 days
3. **Filter Pending**: Skips domains that already have a pending renewal
4. **Batch Process**: Renews up to 10 certificates per run (prevents overwhelming the system)
5. **Prioritize**: Processes certificates expiring soonest first
6. **Log Results**: Returns summary of renewed/failed certificates

## Important Notes

- ✅ **HTTP-01 certificates renew automatically**
- ❌ **DNS-01 certificates require manual renewal** (user must re-add TXT record)
- 🔒 **Secured with INTERNAL_API_SECRET** - never expose this publicly
- 📊 **Logs all operations** for debugging and monitoring
- ⚡ **Rate limit aware** - respects Let's Encrypt rate limits
- 🎯 **Smart batching** - processes a limited number per run to prevent overload

## Troubleshooting

### Renewal Failed

Check the certificate's `lastError` field in the database:
```sql
SELECT domain.domain, status, lastError, renewalAttempts
FROM DomainCertificate
JOIN CustomDomain ON DomainCertificate.domainId = CustomDomain.id;
```

### Manual Renewal Required

For DNS-01 certificates, notify users to manually renew:
1. User goes to domain settings
2. Clicks "Renew" button
3. Follows DNS-01 wizard to add new TXT record
4. System issues new certificate

### Rate Limit Hit

Let's Encrypt limits:
- 50 certificates per registered domain per week
- Auto-renewal respects this limit
- Failed renewals increment `renewalAttempts` counter
- Consider spreading renewals across the week if you hit limits
