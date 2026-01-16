-- Run this script as postgres superuser to create the database and user
-- psql -U postgres -f setup-db.sql

-- Create database
CREATE DATABASE tweetgarot_pm;

-- Create application user (optional, can use postgres user for development)
-- CREATE USER tweetgarot_app WITH PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE tweetgarot_pm TO tweetgarot_app;

-- Connect to the new database and set up schema
\c tweetgarot_pm

-- The schema will be created by running migrations
-- From backend directory: npm run migrate
