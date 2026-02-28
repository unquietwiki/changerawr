#!/bin/bash
set -e

echo "🦖 Starting Changerawr deployment..."

# Start maintenance server in the background
echo "🦖 Starting maintenance server..."
node scripts/maintenance/server.js &
MAINTENANCE_PID=$!

# Function to cleanup maintenance server
cleanup_maintenance() {
    if [ -n "$MAINTENANCE_PID" ]; then
        echo "🦖 Stopping maintenance server..."
        kill $MAINTENANCE_PID 2>/dev/null || true
        # Don't wait - just kill and move on
    fi
}

# Trap to ensure maintenance server is cleaned up
trap cleanup_maintenance EXIT

# Give maintenance server a moment to start
sleep 2

echo "🦖 Maintenance server running (PID: $MAINTENANCE_PID)"
echo "🦖 Starting application setup..."

# Generate Prisma client
echo "🦖 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🦖 Running database migrations..."
npx prisma migrate deploy

# Run the widget build script
echo "🦖 Building widget..."
npm run build:widget

# Generate Swagger documentation
echo "🦖 Generating Swagger documentation..."
npm run generate-swagger

# Stop maintenance server
echo "🦖 Setup complete! Stopping maintenance server..."
cleanup_maintenance

# Small delay to ensure port is released
sleep 1

# Clean up any leftover domain configs from previous runs that might reference missing certs
echo "🦖 Cleaning up any stale domain configs..."
rm -f /etc/nginx/sites-enabled/*.conf 2>/dev/null || true
echo "🦖 Cleaned up $(ls -1 /etc/nginx/sites-enabled/*.conf 2>/dev/null | wc -l) domain configs"

# Test and start nginx in daemon mode (background)
echo "🦖 Testing nginx configuration..."
if ! nginx -t 2>&1; then
    echo "❌ nginx configuration test failed even after cleanup!"
    echo "🦖 Last chance: nuking cert directory and retrying..."

    # Nuclear option: remove all certs and configs
    rm -rf /etc/ssl/changerawr/* 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/*.conf 2>/dev/null || true

    if ! nginx -t 2>&1; then
        echo "❌ nginx configuration is fundamentally broken, exiting..."
        exit 1
    fi
    echo "✅ nginx configuration fixed after nuclear cleanup!"
fi

echo "🦖 Starting nginx..."
nginx 2>&1
if [ $? -eq 0 ]; then
    echo "🦖 nginx started successfully"
else
    echo "⚠️  nginx failed to start, continuing without nginx..."
fi

# Start nginx-agent if SSL is enabled
if [ "$NEXT_PUBLIC_SSL_ENABLED" = "true" ]; then
    echo "🦖 Starting nginx-agent..."
    if [ -d /nginx-agent ]; then
        cd /nginx-agent

        # Set agent environment variables
        export AGENT_SECRET="${NGINX_AGENT_SECRET}"
        export CHANGERAWR_URL="http://127.0.0.1:3000"
        export INTERNAL_API_SECRET="${INTERNAL_API_SECRET}"
        export AGENT_PORT="${NGINX_AGENT_PORT:-7842}"
        export CERT_DIR="/etc/ssl/changerawr"
        export NGINX_DIR="/etc/nginx/sites-enabled"
        export NGINX_RELOAD_CMD="/usr/local/bin/nginx-reload.sh"

        # Make sure agent doesn't try to bind to port 80
        npm start 2>&1 &
        NGINX_AGENT_PID=$!
        echo "🦖 nginx-agent running (PID: $NGINX_AGENT_PID)"
        cd /app
    else
        echo "⚠️  nginx-agent directory not found, skipping..."
    fi
else
    echo "🦖 SSL not enabled, skipping nginx-agent..."
fi

# Start Next.js application in background
echo "🦖 Starting Next.js application on port 3000..."
# Ensure Next.js uses port 3000
export PORT=3000
export HOSTNAME="0.0.0.0"
"$@" &
APP_PID=$!
echo "🦖 Next.js running (PID: $APP_PID)"

# Function to handle shutdown gracefully
shutdown() {
    echo "🦖 Shutting down..."

    # Stop Next.js
    if [ -n "$APP_PID" ]; then
        echo "🦖 Stopping Next.js (PID: $APP_PID)..."
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi

    # Stop nginx-agent
    if [ -n "$NGINX_AGENT_PID" ]; then
        echo "🦖 Stopping nginx-agent (PID: $NGINX_AGENT_PID)..."
        kill -TERM "$NGINX_AGENT_PID" 2>/dev/null || true
        wait "$NGINX_AGENT_PID" 2>/dev/null || true
    fi

    # Stop nginx
    echo "🦖 Stopping nginx..."
    nginx -s quit 2>/dev/null || true

    echo "🦖 Shutdown complete"
    exit 0
}

# Trap signals for graceful shutdown
trap shutdown SIGTERM SIGINT

# Wait for Next.js process (keeps container alive)
echo "🦖 All services started. Waiting for Next.js process..."
wait "$APP_PID"

# If Next.js exits, trigger shutdown
echo "🦖 Next.js process exited"
shutdown