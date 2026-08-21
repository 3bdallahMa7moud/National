-- =====================================================
-- Table Creation Script
-- =====================================================

-- 1. users - المستخدمين
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    account_locked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. packages - الباقات
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    price DECIMAL(10, 2) NOT NULL,
    features_ar JSONB,
    features_en JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    delivery_days INT NOT NULL,
    max_revisions INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. offers - العروض المؤقتة
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    package_id INT NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
