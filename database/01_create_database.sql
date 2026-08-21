-- =====================================================
-- سند - Sanad CV Writing Platform
-- Database Creation Script
-- =====================================================

-- Create database
DROP DATABASE IF EXISTS sanad_db;
CREATE DATABASE sanad_db
    WITH
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Connect to database
\c sanad_db;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'Asia/Dubai';
