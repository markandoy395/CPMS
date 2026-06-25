import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.CPMS_DB_HOST || '127.0.0.1',
  port: Number(process.env.CPMS_DB_PORT || 3306),
  database: process.env.CPMS_DB_NAME || 'cpms_react',
  user: process.env.CPMS_DB_USER || 'root',
  password: process.env.CPMS_DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true
})

export async function rows(sql, params = [], executor = pool) {
  const [result] = await executor.execute(sql, params)
  return result
}

export async function one(sql, params = [], executor = pool) {
  const result = await rows(sql, params, executor)
  return result[0] || null
}

export async function ensureDatabaseSchema() {
  const roleColumn = await one("SHOW COLUMNS FROM users LIKE 'role'")
  if (roleColumn && !String(roleColumn.Type).includes("'Super Admin'")) {
    await rows("ALTER TABLE users MODIFY role ENUM('Super Admin','Admin','Custodian','Auditor') NOT NULL DEFAULT 'Custodian'")
  }

  const statusColumn = await one("SHOW COLUMNS FROM items LIKE 'status'")
  if (statusColumn && !String(statusColumn.Type).includes("'Borrowed'")) {
    await rows("ALTER TABLE items MODIFY status ENUM('Active','Assigned','Borrowed','In Repair','Returned','Disposed','Lost') NOT NULL DEFAULT 'Active'")
  }

  await rows(`CREATE TABLE IF NOT EXISTS public_borrowers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    borrower_name VARCHAR(180) NOT NULL,
    department VARCHAR(120) NOT NULL,
    room_name VARCHAR(120) NOT NULL,
    status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`)

  await rows(`CREATE TABLE IF NOT EXISTS public_auth_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    borrower_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_public_tokens_borrower FOREIGN KEY (borrower_id) REFERENCES public_borrowers(id) ON DELETE CASCADE,
    INDEX idx_public_tokens_expiry (expires_at)
  ) ENGINE=InnoDB`)

  await rows(`CREATE TABLE IF NOT EXISTS borrow_records (
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
    condition_out ENUM('New','Good','Fair','Damaged','Under Repair') NOT NULL DEFAULT 'Good',
    condition_return ENUM('New','Good','Fair','Damaged','Under Repair') NULL,
    remarks TEXT NULL,
    status ENUM('Borrowed','Overdue','Returned','Cancelled') NOT NULL DEFAULT 'Borrowed',
    recorded_by BIGINT UNSIGNED NOT NULL,
    returned_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_borrow_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_returned_by FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_borrow_status_due (status,due_date),
    INDEX idx_borrow_item (item_id)
  ) ENGINE=InnoDB`)

  await rows(`CREATE TABLE IF NOT EXISTS borrow_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT UNSIGNED NOT NULL,
    requester_id BIGINT UNSIGNED NULL,
    public_token CHAR(64) NULL,
    borrower_name VARCHAR(180) NOT NULL,
    borrower_reference VARCHAR(100) NULL,
    department VARCHAR(120) NULL,
    contact_number VARCHAR(40) NULL,
    purpose TEXT NULL,
    requested_borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    condition_out ENUM('New','Good','Fair','Damaged','Under Repair') NOT NULL DEFAULT 'Good',
    remarks TEXT NULL,
    status ENUM('Pending','Approved','Picked Up','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
    ticket_number VARCHAR(40) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    picked_up_at DATETIME NULL,
    picked_up_by BIGINT UNSIGNED NULL,
    review_notes TEXT NULL,
    borrow_record_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_borrow_request_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_borrow_request_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_borrow_request_pickup_by FOREIGN KEY (picked_up_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_borrow_request_record FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id) ON DELETE SET NULL,
    UNIQUE KEY uq_borrow_request_public_token (public_token),
    UNIQUE KEY uq_borrow_request_ticket (ticket_number),
    INDEX idx_borrow_request_status (status,created_at),
    INDEX idx_borrow_request_item (item_id),
    INDEX idx_borrow_requester (requester_id)
  ) ENGINE=InnoDB`)

  const borrowRequesterColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'requester_id'")
  if (borrowRequesterColumn && borrowRequesterColumn.Null === 'NO') {
    await rows('ALTER TABLE borrow_requests MODIFY requester_id BIGINT UNSIGNED NULL')
  }

  const borrowPublicTokenColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'public_token'")
  if (!borrowPublicTokenColumn) {
    await rows('ALTER TABLE borrow_requests ADD COLUMN public_token CHAR(64) NULL AFTER requester_id')
  }

  const borrowTicketColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'ticket_number'")
  if (!borrowTicketColumn) {
    await rows('ALTER TABLE borrow_requests ADD COLUMN ticket_number VARCHAR(40) NULL AFTER status')
  }

  const borrowRequestStatusColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'status'")
  if (borrowRequestStatusColumn && !String(borrowRequestStatusColumn.Type).includes("'Picked Up'")) {
    await rows("ALTER TABLE borrow_requests MODIFY status ENUM('Pending','Approved','Picked Up','Rejected','Cancelled') NOT NULL DEFAULT 'Pending'")
  }

  const borrowPickedUpAtColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'picked_up_at'")
  if (!borrowPickedUpAtColumn) {
    await rows('ALTER TABLE borrow_requests ADD COLUMN picked_up_at DATETIME NULL AFTER reviewed_at')
  }

  const borrowPickedUpByColumn = await one("SHOW COLUMNS FROM borrow_requests LIKE 'picked_up_by'")
  if (!borrowPickedUpByColumn) {
    await rows('ALTER TABLE borrow_requests ADD COLUMN picked_up_by BIGINT UNSIGNED NULL AFTER picked_up_at')
  }

  const borrowPublicTokenIndex = await one("SHOW INDEX FROM borrow_requests WHERE Key_name='uq_borrow_request_public_token'")
  if (!borrowPublicTokenIndex) {
    await rows('ALTER TABLE borrow_requests ADD UNIQUE KEY uq_borrow_request_public_token (public_token)')
  }

  const borrowTicketIndex = await one("SHOW INDEX FROM borrow_requests WHERE Key_name='uq_borrow_request_ticket'")
  if (!borrowTicketIndex) {
    await rows('ALTER TABLE borrow_requests ADD UNIQUE KEY uq_borrow_request_ticket (ticket_number)')
  }

  const borrowPickupByConstraint = await one(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME='borrow_requests'
      AND CONSTRAINT_NAME='fk_borrow_request_pickup_by'
  `)
  if (!borrowPickupByConstraint) {
    await rows('ALTER TABLE borrow_requests ADD CONSTRAINT fk_borrow_request_pickup_by FOREIGN KEY (picked_up_by) REFERENCES users(id) ON DELETE SET NULL')
  }

  await rows("UPDATE borrow_requests SET status='Picked Up' WHERE status='Approved' AND picked_up_at IS NOT NULL")
}
