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
}
