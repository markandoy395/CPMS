-- ============================================
-- CUSTODIAL PROPERTY MANAGEMENT SYSTEM (CPMS)
-- Supabase PostgreSQL Schema Setup
-- ============================================

-- Drop existing tables if they exist (use with caution!)
-- DROP TABLE IF EXISTS item_assignments CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS departments CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS custodians CASCADE;
-- DROP TABLE IF EXISTS items CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Custodian',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('Admin', 'Custodian', 'Auditor')),
    CONSTRAINT valid_status CHECK (status IN ('Active', 'Inactive'))
);

-- ============================================
-- 2. ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS items (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_value NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available',
    date_acquired DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_quantity CHECK (quantity >= 0),
    CONSTRAINT valid_unit_value CHECK (unit_value >= 0),
    CONSTRAINT valid_status CHECK (status IN ('Available', 'Assigned', 'Damaged', 'Disposed'))
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_item_code ON items(item_code);

-- ============================================
-- 3. CUSTODIANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS custodians (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    contact_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('Active', 'Inactive'))
);

CREATE INDEX idx_custodians_user_id ON custodians(user_id);
CREATE INDEX idx_custodians_department ON custodians(department);
CREATE INDEX idx_custodians_status ON custodians(status);

-- ============================================
-- 4. TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    custodian_id BIGINT REFERENCES custodians(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    par_id VARCHAR(50),
    ics_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_type CHECK (transaction_type IN ('Issuance', 'Transfer', 'Return', 'Disposal'))
);

CREATE INDEX idx_transactions_item_id ON transactions(item_id);
CREATE INDEX idx_transactions_custodian_id ON transactions(custodian_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_issued_by ON transactions(issued_by);

-- ============================================
-- 5. ITEM ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS item_assignments (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    custodian_id BIGINT NOT NULL REFERENCES custodians(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    return_date DATE,
    condition VARCHAR(20) NOT NULL DEFAULT 'Good',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_condition CHECK (condition IN ('Good', 'Fair', 'Poor', 'Damaged'))
);

CREATE INDEX idx_item_assignments_item_id ON item_assignments(item_id);
CREATE INDEX idx_item_assignments_custodian_id ON item_assignments(custodian_id);
CREATE INDEX idx_item_assignments_date ON item_assignments(assignment_date);

-- ============================================
-- 6. CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. DEPARTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    department_name VARCHAR(100) UNIQUE NOT NULL,
    head_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_departments_head_id ON departments(head_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custodians ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Items table policies (authenticated users can view)
CREATE POLICY "Authenticated users can view items" ON items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage items" ON items
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Custodians table policies
CREATE POLICY "Authenticated users can view custodians" ON custodians
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage custodians" ON custodians
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Transactions table policies
CREATE POLICY "Authenticated users can view transactions" ON transactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage transactions" ON transactions
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Item assignments table policies
CREATE POLICY "Authenticated users can view assignments" ON item_assignments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage assignments" ON item_assignments
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Categories table policies
CREATE POLICY "Authenticated users can view categories" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- Departments table policies
CREATE POLICY "Authenticated users can view departments" ON departments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage departments" ON departments
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM users WHERE role = 'Admin')
    );

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Note: Replace 'user-id-here' with actual Supabase user IDs

-- Insert sample categories
INSERT INTO categories (category_name, description) VALUES
    ('IT Equipment', 'Computers, peripherals, and IT hardware'),
    ('Furniture', 'Office furniture and fixtures'),
    ('Office Supplies', 'General office supplies'),
    ('Other', 'Miscellaneous items')
ON CONFLICT (category_name) DO NOTHING;

-- ============================================
-- FUNCTIONS & TRIGGERS (Optional)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custodians_updated_at BEFORE UPDATE ON custodians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_assignments_updated_at BEFORE UPDATE ON item_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS (Optional - for reporting)
-- ============================================

-- Inventory Summary View
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
    COUNT(*) as total_items,
    SUM(quantity) as total_quantity,
    SUM(quantity * unit_value) as total_value,
    COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_items,
    COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assigned_items,
    COUNT(CASE WHEN status = 'Damaged' THEN 1 END) as damaged_items,
    COUNT(CASE WHEN status = 'Disposed' THEN 1 END) as disposed_items
FROM items;

-- Custodian Assets View
CREATE OR REPLACE VIEW custodian_assets AS
SELECT
    c.id,
    c.user_id,
    u.name as custodian_name,
    c.department,
    COUNT(ia.id) as total_assets,
    COUNT(CASE WHEN ia.return_date IS NULL THEN 1 END) as active_assets
FROM custodians c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN item_assignments ia ON c.id = ia.custodian_id
GROUP BY c.id, c.user_id, u.name, c.department;

-- ============================================
-- END OF SCHEMA SETUP
-- ============================================
