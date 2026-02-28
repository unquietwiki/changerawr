#!/bin/bash
# nginx reload wrapper with automatic cleanup on failure
# Used by nginx-agent to safely reload nginx after config changes

SITES_ENABLED="/etc/nginx/sites-enabled"
BACKUP_DIR="/tmp/nginx-backup-$(date +%s)"

echo "[nginx-reload] Testing new configuration..."

# Test the configuration
if nginx -t 2>&1; then
    echo "[nginx-reload] Configuration valid"
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
        echo "[nginx-reload] ✅ Configuration fixed"
    else
        echo "[nginx-reload] ❌ Configuration still broken after cleanup!"
        exit 1
    fi
fi

# Check if nginx is actually running before trying to reload
if [ -f /run/nginx/nginx.pid ] && [ -n "$(cat /run/nginx/nginx.pid 2>/dev/null)" ] && kill -0 $(cat /run/nginx/nginx.pid) 2>/dev/null; then
    echo "[nginx-reload] Reloading nginx..."
    nginx -s reload
    echo "[nginx-reload] ✅ Reload successful"
else
    echo "[nginx-reload] ⚠️  nginx not running, skipping reload (will use config on next start)"
fi

exit 0
