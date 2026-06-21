CREATE DATABASE IF NOT EXISTS cpms_react CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cpms_react;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Super Admin', 'Admin', 'Custodian', 'Auditor') NOT NULL DEFAULT 'Custodian',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  postal_code VARCHAR(30) NULL,
  bio TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tokens_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS custodians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL,
  position VARCHAR(120) NULL,
  contact_number VARCHAR(40) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  last_verification DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_custodians_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_custodian_department (department)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100) NULL,
  item_code VARCHAR(80) NOT NULL UNIQUE,
  serial_number VARCHAR(120) NULL,
  model_number VARCHAR(120) NULL,
  brand VARCHAR(120) NULL,
  purchase_date DATE NULL,
  po_number VARCHAR(100) NULL,
  vendor VARCHAR(180) NULL,
  invoice_number VARCHAR(100) NULL,
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  funding_source VARCHAR(120) NULL,
  campus VARCHAR(120) NULL,
  building VARCHAR(120) NULL,
  room_number VARCHAR(80) NULL,
  department VARCHAR(120) NULL,
  assigned_to VARCHAR(180) NULL,
  custodian_id BIGINT UNSIGNED NULL,
  asset_type ENUM('Fixed Asset', 'Consumable', 'Non-Consumable') NOT NULL DEFAULT 'Fixed Asset',
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  condition_status ENUM('New', 'Good', 'Fair', 'Damaged', 'Under Repair') NOT NULL DEFAULT 'New',
  warranty_expiry DATE NULL,
  maintenance_schedule VARCHAR(40) NULL,
  insurance_policy VARCHAR(120) NULL,
  status ENUM('Active', 'Assigned', 'Borrowed', 'In Repair', 'Returned', 'Disposed', 'Lost') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_custodian FOREIGN KEY (custodian_id) REFERENCES custodians(id) ON DELETE SET NULL,
  INDEX idx_items_category (category),
  INDEX idx_items_status (status),
  INDEX idx_items_custodian (custodian_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  custodian_id BIGINT UNSIGNED NOT NULL,
  assignment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  return_date DATETIME NULL,
  condition_status VARCHAR(40) NOT NULL DEFAULT 'Good',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assign_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assign_custodian FOREIGN KEY (custodian_id) REFERENCES custodians(id) ON DELETE RESTRICT,
  INDEX idx_assign_active (item_id, return_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  custodian_id BIGINT UNSIGNED NULL,
  from_custodian_id BIGINT UNSIGNED NULL,
  transaction_type ENUM('Issuance', 'Transfer', 'Return', 'Disposal') NOT NULL,
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_by BIGINT UNSIGNED NOT NULL,
  notes TEXT NULL,
  par_id VARCHAR(100) NULL,
  ics_id VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transaction_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transaction_custodian FOREIGN KEY (custodian_id) REFERENCES custodians(id) ON DELETE SET NULL,
  CONSTRAINT fk_transaction_from FOREIGN KEY (from_custodian_id) REFERENCES custodians(id) ON DELETE SET NULL,
  CONSTRAINT fk_transaction_user FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_transaction_date (transaction_date),
  INDEX idx_transaction_type (transaction_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS borrow_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  borrower_name VARCHAR(180) NOT NULL,
  borrower_reference VARCHAR(100) NULL,
  department VARCHAR(120) NULL,
  contact_number VARCHAR(40) NULL,
  purpose TEXT NULL,
  borrowed_date DATE NOT NULL,
  due_date DATE NOT NULL,
  returned_date DATETIME NULL,
  condition_out ENUM('New', 'Good', 'Fair', 'Damaged', 'Under Repair') NOT NULL DEFAULT 'Good',
  condition_return ENUM('New', 'Good', 'Fair', 'Damaged', 'Under Repair') NULL,
  remarks TEXT NULL,
  status ENUM('Borrowed', 'Overdue', 'Returned', 'Cancelled') NOT NULL DEFAULT 'Borrowed',
  recorded_by BIGINT UNSIGNED NOT NULL,
  returned_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_borrow_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_borrow_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_borrow_returned_by FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_borrow_status_due (status, due_date),
  INDEX idx_borrow_item (item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  custodian_id BIGINT UNSIGNED NULL,
  maintenance_type VARCHAR(120) NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_date DATE NULL,
  cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_custodian FOREIGN KEY (custodian_id) REFERENCES custodians(id) ON DELETE SET NULL,
  CONSTRAINT fk_maintenance_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  custodian_id BIGINT UNSIGNED NOT NULL,
  verification_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_items_expected INT UNSIGNED NOT NULL DEFAULT 0,
  items_found INT UNSIGNED NOT NULL DEFAULT 0,
  items_missing INT UNSIGNED NOT NULL DEFAULT 0,
  discrepancies JSON NULL,
  status ENUM('Completed', 'Needs Review') NOT NULL DEFAULT 'Completed',
  verified_by BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_verification_custodian FOREIGN KEY (custodian_id) REFERENCES custodians(id) ON DELETE RESTRICT,
  CONSTRAINT fk_verification_user FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  email_notifications TINYINT(1) NOT NULL DEFAULT 1,
  system_notifications TINYINT(1) NOT NULL DEFAULT 1,
  activity_log TINYINT(1) NOT NULL DEFAULT 1,
  item_updates TINYINT(1) NOT NULL DEFAULT 1,
  transaction_alerts TINYINT(1) NOT NULL DEFAULT 1,
  weekly_reports TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generated_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL,
  worksheet_name VARCHAR(190) NULL,
  output_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(40) NOT NULL,
  status ENUM('Generated', 'Approved', 'Cancelled') NOT NULL DEFAULT 'Generated',
  generated_by BIGINT UNSIGNED NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_user FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_document_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  attachment_type ENUM('Photo', 'Document') NOT NULL DEFAULT 'Document',
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attachment_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_attachment_item (item_id)
) ENGINE=InnoDB;
