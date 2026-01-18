#!/bin/bash
# Render deployment startup script
# Runs migrations before starting the server

echo "Running database migrations..."
node src/migrations/run.js

echo "Starting server..."
node src/index.js
