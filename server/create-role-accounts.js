import crypto from 'node:crypto'
import process from 'node:process'
import { ensureDatabaseSchema, one, pool, rows } from './db.js'
import { hashPassword } from './security.js'

const accounts = [
  {
    role: 'Super Admin',
    name: process.env.CPMS_SUPER_ADMIN_NAME || 'CPMS Super Admin',
    email: process.env.CPMS_SUPER_ADMIN_EMAIL || 'superadmin@cpms.local',
    password: process.env.CPMS_SUPER_ADMIN_PASSWORD
  },
  {
    role: 'Admin',
    name: process.env.CPMS_ADMIN_NAME || 'CPMS Administrator',
    email: process.env.CPMS_ADMIN_EMAIL || 'admin@cpms.local',
    password: process.env.CPMS_ADMIN_PASSWORD
  },
  {
    role: 'Auditor',
    name: process.env.CPMS_AUDITOR_NAME || 'CPMS Auditor',
    email: process.env.CPMS_AUDITOR_EMAIL || 'auditor@cpms.local',
    password: process.env.CPMS_AUDITOR_PASSWORD
  },
  {
    role: 'Custodian',
    name: process.env.CPMS_CUSTODIAN_NAME || 'CPMS Custodian',
    email: process.env.CPMS_CUSTODIAN_EMAIL || 'custodian@cpms.local',
    password: process.env.CPMS_CUSTODIAN_PASSWORD
  }
]

function generatedPassword() {
  return crypto.randomBytes(14).toString('base64url')
}

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ''))
}

await ensureDatabaseSchema()

const credentials = []

for (const account of accounts) {
  const email = String(account.email || '').trim().toLowerCase()
  const password = account.password || generatedPassword()
  if (!validEmail(email) || password.length < 12) {
    console.error(`Invalid ${account.role} account. Email must be valid and password must be at least 12 characters.`)
    process.exitCode = 1
    break
  }

  await rows(
    `INSERT INTO users (name,email,password_hash,role,status) VALUES (?,?,?,?,'Active')
     ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash),role=VALUES(role),status='Active'`,
    [account.name.trim(), email, await hashPassword(password), account.role]
  )
  const user = await one('SELECT id FROM users WHERE email=?', [email])
  await rows('INSERT IGNORE INTO user_preferences (user_id) VALUES (?)', [user.id])
  if (account.role === 'Custodian') {
    await rows("INSERT IGNORE INTO custodians (user_id,department) VALUES (?,'Unassigned')", [user.id])
  }
  credentials.push({ role: account.role, email, password })
}

if (!process.exitCode) {
  console.log('Role accounts created or updated.')
  console.table(credentials)
}

await pool.end()
