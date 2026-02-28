#!/bin/bash
# nginx reload wrapper with automatic cleanup on failure
# Used by nginx-agent to safely reload nginx after config changes

set -e

SITES_ENABLED="/etc/nginx/sites-enabled"
BACKUP_DIR="/tmp/nginx-backup-$(date +%s)"

echo "[nginx-reload] Testing new configuration..."

# Test the configuration
if nginx -t 2>&1; then
    echo "[nginx-reload] Configuration valid, reloading nginx..."
    nginx -s reload
    echo "[nginx-reload] ✅ Reload successful"
    exit 0
else
    echo "[nginx-reload] ❌ Configuration test failed!"

    # Backup current configs
    mkdir -p "$BACKUP_DIR"
    if [ -n "$(ls -A $SITES_ENABLED/*.conf 2>/dev/null)" ]; then
        cp "$SITES_ENABLED"/*.conf "$BACKUP_DIR/" 2>/dev/null || true
        echo "[nginx-reload] Backed up configs to $BACKUP_DIR"
    fi

    # Remove all custom domain configs
    rm -f "$SITES_ENABLED"/*.conf
    echo "[nginx-reload] Removed broken custom domain configs"

    # Test again
    if nginx -t 2>&1; then
        echo "[nginx-reload] Configuration fixed, reloading..."
        nginx -s reload
        echo "[nginx-reload] ✅ Reload successful after cleanup"
        exit 0
    else
        echo "[nginx-reload] ❌ Configuration still broken after cleanup!"
        exit 1
    fi
fi
