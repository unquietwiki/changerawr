#!/bin/bash
set -e

echo "🦖 Starting Changerawr deployment..."

# Start maintenance server in the background
echo "🦖 Starting maintenance server..."
node scripts/maintenance/server.js &
MAINTENANCE_PID=$!

# Function to cleanup maintenance server
cleanup_maintenance() {
    echo "🦖 Stopping maintenance server..."
    kill $MAINTENANCE_PID 2>/dev/null || true
    wait $MAINTENANCE_PID 2>/dev/null || true
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

# Start nginx
echo "🦖 Starting nginx..."
nginx -t && nginx
echo "🦖 nginx started"

# Start Next.js application in background
echo "🦖 Starting Next.js application on port 3000..."
"$@" &
APP_PID=$!
echo "🦖 Next.js running (PID: $APP_PID)"

# Start nginx-agent if SSL is enabled
if [ "$NEXT_PUBLIC_SSL_ENABLED" = "true" ]; then
    echo "🦖 Starting nginx-agent..."
    cd /nginx-agent

    # Set agent environment variables if not already set
    export AGENT_SECRET="${NGINX_AGENT_SECRET:-}"
    export CHANGERAWR_URL="${CHANGERAWR_URL:-http://127.0.0.1:3000}"
    export INTERNAL_API_SECRET="${INTERNAL_API_SECRET:-}"
    export AGENT_PORT="${NGINX_AGENT_PORT:-7842}"
    export CERT_DIR="${NGINX_CERT_DIR:-/etc/ssl/changerawr}"
    export NGINX_DIR="${NGINX_CONFIG_DIR:-/etc/nginx/sites-enabled}"
    export NGINX_RELOAD_CMD="${NGINX_RELOAD_CMD:-nginx -s reload}"

    npm start &
    NGINX_AGENT_PID=$!
    echo "🦖 nginx-agent running (PID: $NGINX_AGENT_PID)"
    cd /app
fi

# Wait for Next.js process
wait $APP_PID