import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { ensureDatabaseSchema, one, pool, rows } from './db.js'
import {
  audit,
  authenticate,
  bearerToken,
  cleanUser,
  hashPassword,
  httpError,
  optionalAuthenticate,
  requireRoles,
  sha256,
  verifyPassword
} from './security.js'

const app = express()
const port = Number(process.env.CPMS_API_PORT || 8000)
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const attachmentDirectory = path.join(rootDirectory, 'server', 'storage', 'attachments')
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
])
const validConditions = new Set(['New', 'Good', 'Fair', 'Damaged', 'Under Repair'])
const validUserRoles = new Set(['Super Admin', 'Admin', 'Custodian', 'Auditor'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
})

app.disable('x-powered-by')
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }))
app.use(express.json({ limit: '2mb' }))
app.use('/assets', express.static(path.join(rootDirectory, 'assets')))
app.use('/user', express.static(path.join(rootDirectory, 'user')))

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ''))
}

function validId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function validRole(value) {
  return validUserRoles.has(value) ? value : 'Custodian'
}

function canManageRole(actor, role) {
  return actor?.role === 'Super Admin' || role !== 'Super Admin'
}

function canReviewBorrowRequests(user) {
  return user?.role === 'Super Admin' || user?.role === 'Admin'
}

function makeBorrowTicketNumber(requestId) {
  return `CPMS-${new Date().getFullYear()}-${String(requestId).padStart(6, '0')}`
}

async function wouldRemoveLastActiveSuperAdmin(userId, nextRole = null, nextStatus = null) {
  const user = await one('SELECT id,role,status FROM users WHERE id=?', [userId])
  if (!user || user.role !== 'Super Admin' || user.status !== 'Active') return false
  const keepsActiveSuperAdmin = (nextRole ?? user.role) === 'Super Admin' && (nextStatus ?? user.status) === 'Active'
  if (keepsActiveSuperAdmin) return false
  const count = await one("SELECT COUNT(*) count FROM users WHERE role='Super Admin' AND status='Active'")
  return Number(count?.count || 0) <= 1
}

function parseJson(value, fallback = null) {
  if (value == null || typeof value !== 'string') return value ?? fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function itemValues(body) {
  return [
    body.item_name || null,
    body.description || null,
    body.category || null,
    body.subcategory || null,
    body.item_code || null,
    body.serial_number || null,
    body.model_number || null,
    body.brand || null,
    body.purchase_date || null,
    body.po_number || null,
    body.vendor || null,
    body.invoice_number || null,
    Math.max(0, Number(body.unit_cost || 0)),
    Math.max(0, Number(body.total_cost || 0)),
    body.funding_source || null,
    body.campus || null,
    body.building || null,
    body.room_number || null,
    body.department || null,
    body.assigned_to || null,
    validId(body.custodian_id),
    body.asset_type || 'Fixed Asset',
    Math.max(1, Number.parseInt(body.quantity || 1, 10)),
    body.condition || 'New',
    body.warranty_expiry || null,
    body.maintenance_schedule || null,
    body.insurance_policy || null,
    body.status || 'Active'
  ]
}

const itemColumns = [
  'item_name', 'description', 'category', 'subcategory', 'item_code', 'serial_number', 'model_number', 'brand',
  'purchase_date', 'po_number', 'vendor', 'invoice_number', 'unit_cost', 'total_cost', 'funding_source', 'campus',
  'building', 'room_number', 'department', 'assigned_to', 'custodian_id', 'asset_type', 'quantity', 'condition_status',
  'warranty_expiry', 'maintenance_schedule', 'insurance_policy', 'status'
]

app.get('/health', async (_req, res) => {
  await rows('SELECT 1')
  res.json({ success: true, status: 'ok', database: 'connected', backend: 'node' })
})

app.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const user = await one('SELECT * FROM users WHERE email=? LIMIT 1', [email])
  if (!user || user.status !== 'Active' || !(await verifyPassword(String(req.body.password || ''), user.password_hash))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' })
  }
  const token = crypto.randomBytes(32).toString('hex')
  await rows('INSERT INTO auth_tokens (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))', [user.id, sha256(token)])
  await audit(user.id, 'login', 'auth', user.id, null, req)
  res.json({ success: true, user: cleanUser(user), token })
})

app.post('/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!name || !validEmail(email) || password.length < 8) {
    return res.status(422).json({ success: false, message: 'Name, valid email, and an 8-character password are required' })
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'Custodian')",
      [name, email, await hashPassword(password)]
    )
    await connection.execute("INSERT INTO custodians (user_id,department) VALUES (?,'Unassigned')", [result.insertId])
    await connection.execute('INSERT INTO user_preferences (user_id) VALUES (?)', [result.insertId])
    await connection.commit()
    await audit(result.insertId, 'signup', 'user', result.insertId, null, req)
    res.status(201).json({ success: true, message: 'Account created. An administrator can update your department.' })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

app.get('/auth/me', authenticate, (req, res) => res.json({ success: true, user: req.user }))

app.post('/auth/logout', optionalAuthenticate, async (req, res) => {
  const token = bearerToken(req)
  if (token) await rows('DELETE FROM auth_tokens WHERE token_hash=?', [sha256(token)])
  if (req.user) await audit(req.user.id, 'logout', 'auth', req.user.id, null, req)
  res.json({ success: true })
})

app.put('/auth/profile', authenticate, async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!name || !validEmail(email)) return res.status(422).json({ success: false, message: 'Valid name and email are required' })
  await rows(
    'UPDATE users SET name=?,email=?,phone=?,address=?,city=?,state=?,country=?,postal_code=?,bio=? WHERE id=?',
    [name, email, req.body.phone || null, req.body.address || null, req.body.city || null, req.body.state || null,
      req.body.country || null, req.body.postal_code || null, req.body.bio || null, req.user.id]
  )
  await audit(req.user.id, 'update', 'profile', req.user.id, null, req)
  const user = await one('SELECT id,name,email,role,status,phone,address,city,state,country,postal_code,bio,created_at FROM users WHERE id=?', [req.user.id])
  res.json({ success: true, user })
})

app.post('/auth/password', authenticate, async (req, res) => {
  const record = await one('SELECT password_hash FROM users WHERE id=?', [req.user.id])
  if (!(await verifyPassword(String(req.body.current_password || ''), record?.password_hash))) {
    return res.status(422).json({ success: false, message: 'Current password is incorrect' })
  }
  const nextPassword = String(req.body.new_password || '')
  if (nextPassword.length < 8) return res.status(422).json({ success: false, message: 'New password must contain at least 8 characters' })
  await rows('UPDATE users SET password_hash=? WHERE id=?', [await hashPassword(nextPassword), req.user.id])
  await rows('DELETE FROM auth_tokens WHERE user_id=? AND token_hash<>?', [req.user.id, sha256(req.authToken)])
  await audit(req.user.id, 'change_password', 'user', req.user.id, null, req)
  res.json({ success: true })
})

app.get('/public/items', async (req, res) => {
  let sql = `SELECT i.id,i.item_name,i.item_code,i.serial_number,i.category,i.building,i.room_number,i.department,
    i.condition_status AS \`condition\`,i.status,i.custodian_id,
    (SELECT a.id FROM asset_attachments a WHERE a.item_id=i.id AND a.attachment_type='Photo' AND a.mime_type LIKE 'image/%' ORDER BY a.created_at DESC LIMIT 1) photo_id
    FROM items i WHERE i.status<>'Disposed'`
  const values = []
  if (req.query.search) {
    sql += ' AND (i.item_name LIKE ? OR i.item_code LIKE ? OR i.serial_number LIKE ? OR i.category LIKE ?)'
    const term = `%${req.query.search}%`
    values.push(term, term, term, term)
  }
  if (req.query.status) {
    sql += ' AND i.status=?'
    values.push(req.query.status)
  }
  sql += ' ORDER BY i.item_name ASC,i.item_code ASC'
  const data = (await rows(sql, values)).map(item => ({
    ...item,
    image_url: item.photo_id ? `/public/items/${item.id}/photo` : null,
    available_for_borrow: ['Active', 'Returned'].includes(item.status) && !item.custodian_id
  }))
  res.json({ success: true, data })
})

app.get('/public/items/:id/photo', async (req, res) => {
  const itemId = validId(req.params.id)
  if (!itemId) return res.status(400).json({ success: false, message: 'Invalid item ID' })
  const file = await one(`SELECT a.* FROM asset_attachments a JOIN items i ON i.id=a.item_id
    WHERE a.item_id=? AND i.status<>'Disposed' AND a.attachment_type='Photo' AND a.mime_type LIKE 'image/%'
    ORDER BY a.created_at DESC LIMIT 1`, [itemId])
  if (!file) return res.status(404).json({ success: false, message: 'Item photo not found' })
  const filePath = path.join(attachmentDirectory, file.stored_name)
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Stored photo is missing' })
  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Length', file.file_size)
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  fs.createReadStream(filePath).pipe(res)
})

app.post('/public/borrow-requests', async (req, res) => {
  const itemId = validId(req.body.item_id)
  const borrowerName = String(req.body.borrower_name || '').trim()
  const requestedBorrowDate = req.body.requested_borrow_date
  const dueDate = req.body.due_date
  const conditionOut = validConditions.has(req.body.condition_out) ? req.body.condition_out : 'Good'
  if (!itemId || !borrowerName || !requestedBorrowDate || !dueDate) {
    return res.status(422).json({ success: false, message: 'Item, borrower name, borrow date, and due date are required' })
  }
  if (dueDate < requestedBorrowDate) return res.status(422).json({ success: false, message: 'Due date cannot be before the borrow date' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const item = await one('SELECT * FROM items WHERE id=? FOR UPDATE', [itemId], connection)
    if (!item) throw httpError(404, 'Item not found')
    if (!['Active', 'Returned'].includes(item.status) || item.custodian_id) throw httpError(422, 'This asset is not available for borrowing')
    const activeBorrow = await one("SELECT id FROM borrow_records WHERE item_id=? AND status IN ('Borrowed','Overdue') FOR UPDATE", [itemId], connection)
    if (activeBorrow) throw httpError(422, 'This asset already has an active borrowing record')
    const duplicateRequest = await one(
      "SELECT id FROM borrow_requests WHERE item_id=? AND borrower_name=? AND COALESCE(contact_number,'')=? AND status='Pending' FOR UPDATE",
      [itemId, borrowerName, req.body.contact_number || ''],
      connection
    )
    if (duplicateRequest) throw httpError(422, 'A pending request for this borrower and item already exists')
    const publicToken = crypto.randomBytes(32).toString('hex')
    const [result] = await connection.execute(
      `INSERT INTO borrow_requests (item_id,requester_id,public_token,borrower_name,borrower_reference,department,contact_number,purpose,requested_borrow_date,due_date,condition_out,remarks,status)
       VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,'Pending')`,
      [itemId, publicToken, borrowerName, req.body.borrower_reference || null, req.body.department || null, req.body.contact_number || null,
        req.body.purpose || null, requestedBorrowDate, dueDate, conditionOut, req.body.remarks || null]
    )
    await audit(null, 'public_request_borrow', 'borrow_request', result.insertId, { item_id: itemId, due_date: dueDate }, req, connection)
    await connection.commit()
    res.status(201).json({ success: true, data: { id: result.insertId, token: publicToken } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

app.get('/public/borrow-requests/:id', async (req, res) => {
  const id = validId(req.params.id)
  const token = String(req.query.token || '').trim()
  if (!id || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ success: false, message: 'Valid request and ticket token are required' })
  }

  const request = await one(
    `SELECT r.id,r.borrower_name,r.borrower_reference,r.department,r.contact_number,r.purpose,
      r.requested_borrow_date,r.due_date,r.status,r.ticket_number,r.reviewed_at,r.picked_up_at,r.review_notes,r.created_at,
      i.item_name,i.item_code,i.serial_number,b.id borrowing_id,b.status borrow_status,b.borrowed_date,b.returned_date
     FROM borrow_requests r
     JOIN items i ON i.id=r.item_id
     LEFT JOIN borrow_records b ON b.id=r.borrow_record_id
     WHERE r.id=? AND r.public_token=?`,
    [id, token]
  )
  if (!request) return res.status(404).json({ success: false, message: 'Request ticket not found' })

  res.json({ success: true, data: request })
})

app.use('/users', authenticate, requireRoles('Admin'))
app.get('/users', async (_req, res) => {
  const data = await rows('SELECT id,name,email,role,status,created_at,updated_at FROM users ORDER BY created_at DESC')
  res.json({ success: true, data })
})
app.post('/users', async (req, res) => {
  const role = validRole(req.body.role)
  if (!canManageRole(req.user, role)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can create Super Admin accounts' })
  }
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!validEmail(email) || password.length < 8) return res.status(422).json({ success: false, message: 'Valid email and an 8-character password are required' })
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute(
      'INSERT INTO users (name,email,password_hash,role,status) VALUES (?,?,?,?,?)',
      [String(req.body.name || '').trim(), email, await hashPassword(password), role, req.body.status || 'Active']
    )
    await connection.execute('INSERT INTO user_preferences (user_id) VALUES (?)', [result.insertId])
    if (role === 'Custodian') {
      await connection.execute('INSERT INTO custodians (user_id,department) VALUES (?,?)', [result.insertId, String(req.body.department || 'Unassigned').trim()])
    }
    await audit(req.user.id, 'create', 'user', result.insertId, { role }, req, connection)
    await connection.commit()
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/users/:id', async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
  const existing = await one('SELECT id,role,status FROM users WHERE id=?', [id])
  if (!existing) return res.status(404).json({ success: false, message: 'User not found' })
  const role = validRole(req.body.role)
  const status = req.body.status === 'Inactive' ? 'Inactive' : 'Active'
  if (!canManageRole(req.user, existing.role) || !canManageRole(req.user, role)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can manage Super Admin accounts' })
  }
  if (await wouldRemoveLastActiveSuperAdmin(id, role, status)) {
    return res.status(422).json({ success: false, message: 'At least one active Super Admin account is required' })
  }
  await rows('UPDATE users SET name=?,email=?,role=?,status=? WHERE id=?', [String(req.body.name || '').trim(), String(req.body.email || '').trim().toLowerCase(), role, status, id])
  if (req.body.password) {
    if (String(req.body.password).length < 8) return res.status(422).json({ success: false, message: 'Password must contain at least 8 characters' })
    await rows('UPDATE users SET password_hash=? WHERE id=?', [await hashPassword(String(req.body.password)), id])
  }
  await audit(req.user.id, 'update', 'user', id, { role, status }, req)
  res.json({ success: true })
})
app.delete('/users/:id', async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
  if (req.user.id === id) return res.status(422).json({ success: false, message: 'You cannot deactivate your own account' })
  const existing = await one('SELECT id,role,status FROM users WHERE id=?', [id])
  if (!existing) return res.status(404).json({ success: false, message: 'User not found' })
  if (!canManageRole(req.user, existing.role)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can deactivate Super Admin accounts' })
  }
  if (await wouldRemoveLastActiveSuperAdmin(id, existing.role, 'Inactive')) {
    return res.status(422).json({ success: false, message: 'At least one active Super Admin account is required' })
  }
  await rows("UPDATE users SET status='Inactive' WHERE id=?", [id])
  await rows('DELETE FROM auth_tokens WHERE user_id=?', [id])
  await audit(req.user.id, 'deactivate', 'user', id, null, req)
  res.json({ success: true })
})

app.use('/items', authenticate)
app.get('/items/stats', async (_req, res) => {
  const stats = await one(`SELECT COUNT(*) totalItems,COALESCE(SUM(total_cost),0) totalValue,
    SUM(status IN ('Active','Assigned')) activeCount,SUM(condition_status='Damaged') damageCount,
    SUM(custodian_id IS NULL AND status<>'Disposed') notDistributedCount FROM items`)
  res.json({ success: true, stats })
})
app.get('/items', async (req, res) => {
  let sql = `SELECT i.*,i.condition_status AS \`condition\`,u.name AS assigned_to_name FROM items i
    LEFT JOIN custodians c ON c.id=i.custodian_id LEFT JOIN users u ON u.id=c.user_id WHERE 1=1`
  const values = []
  if (req.query.search) { sql += ' AND (i.item_name LIKE ? OR i.item_code LIKE ? OR i.serial_number LIKE ?)'; const term = `%${req.query.search}%`; values.push(term, term, term) }
  if (req.query.category) { sql += ' AND i.category=?'; values.push(req.query.category) }
  if (req.query.status) { sql += ' AND i.status=?'; values.push(req.query.status) }
  sql += ' ORDER BY i.created_at DESC'
  res.json({ success: true, data: await rows(sql, values) })
})
app.get('/items/:id', async (req, res) => {
  const item = await one('SELECT *,condition_status AS `condition` FROM items WHERE id=?', [req.params.id])
  res.status(item ? 200 : 404).json(item ? { success: true, data: item } : { success: false, message: 'Item not found' })
})
app.post('/items', requireRoles('Admin', 'Custodian'), async (req, res) => {
  const placeholders = itemColumns.map(() => '?').join(',')
  const result = await rows(`INSERT INTO items (${itemColumns.join(',')}) VALUES (${placeholders})`, itemValues(req.body))
  await audit(req.user.id, 'create', 'item', result.insertId, { item_code: req.body.item_code }, req)
  res.status(201).json({ success: true, data: { id: result.insertId } })
})
app.put('/items/:id', requireRoles('Admin'), async (req, res) => {
  const assignments = itemColumns.map(column => `${column}=?`).join(',')
  await rows(`UPDATE items SET ${assignments} WHERE id=?`, [...itemValues(req.body), req.params.id])
  await audit(req.user.id, 'update', 'item', req.params.id, null, req)
  res.json({ success: true })
})
app.delete('/items/:id', requireRoles('Admin'), async (req, res) => {
  const count = await one('SELECT COUNT(*) count FROM transactions WHERE item_id=?', [req.params.id])
  if (Number(count.count) > 0) return res.status(422).json({ success: false, message: 'Items with transaction history cannot be deleted' })
  const borrowCount = await one('SELECT COUNT(*) count FROM borrow_records WHERE item_id=?', [req.params.id])
  if (Number(borrowCount.count) > 0) return res.status(422).json({ success: false, message: 'Items with borrowing history cannot be deleted' })
  const borrowRequestCount = await one('SELECT COUNT(*) count FROM borrow_requests WHERE item_id=?', [req.params.id])
  if (Number(borrowRequestCount.count) > 0) return res.status(422).json({ success: false, message: 'Items with borrow request history cannot be deleted' })
  await rows('DELETE FROM items WHERE id=?', [req.params.id])
  await audit(req.user.id, 'delete', 'item', req.params.id, null, req)
  res.json({ success: true })
})

app.use('/custodians', authenticate)
app.get('/custodians/stats', async (_req, res) => {
  const stats = await one("SELECT COUNT(*) totalCustodians,SUM(status='Active') activeCustodians,SUM(status='Inactive') inactiveCustodians FROM custodians")
  res.json({ success: true, stats })
})
app.get('/custodians', async (req, res) => {
  let sql = `SELECT c.*,u.name,u.email,COUNT(i.id) total_items FROM custodians c JOIN users u ON u.id=c.user_id
    LEFT JOIN items i ON i.custodian_id=c.id WHERE 1=1`
  const values = []
  if (req.query.status) { sql += ' AND c.status=?'; values.push(req.query.status) }
  if (req.query.search) { sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.department LIKE ?)'; const term = `%${req.query.search}%`; values.push(term, term, term) }
  sql += ' GROUP BY c.id ORDER BY c.created_at DESC'
  const data = (await rows(sql, values)).map(({ name, email, ...record }) => ({ ...record, users: { id: record.user_id, name, email } }))
  res.json({ success: true, data })
})
app.get('/custodians/:id', async (req, res) => {
  const data = await one('SELECT c.*,u.name,u.email FROM custodians c JOIN users u ON u.id=c.user_id WHERE c.id=?', [req.params.id])
  res.status(data ? 200 : 404).json(data ? { success: true, data } : { success: false, message: 'Custodian not found' })
})
app.post('/custodians', requireRoles('Admin'), async (req, res) => {
  const result = await rows('INSERT INTO custodians (user_id,department,position,contact_number,status) VALUES (?,?,?,?,?)',
    [req.body.user_id, String(req.body.department || '').trim(), req.body.position || null, req.body.contact_number || null, req.body.status || 'Active'])
  await audit(req.user.id, 'create', 'custodian', result.insertId, null, req)
  res.status(201).json({ success: true, data: { id: result.insertId } })
})
app.put('/custodians/:id', requireRoles('Admin'), async (req, res) => {
  await rows('UPDATE custodians SET user_id=?,department=?,position=?,contact_number=?,status=? WHERE id=?',
    [req.body.user_id, String(req.body.department || '').trim(), req.body.position || null, req.body.contact_number || null, req.body.status || 'Active', req.params.id])
  await audit(req.user.id, 'update', 'custodian', req.params.id, null, req)
  res.json({ success: true })
})
app.delete('/custodians/:id', requireRoles('Admin'), async (req, res) => {
  const count = await one('SELECT COUNT(*) count FROM items WHERE custodian_id=?', [req.params.id])
  if (Number(count.count) > 0) return res.status(422).json({ success: false, message: 'Return or transfer assigned items before deactivating this custodian' })
  await rows("UPDATE custodians SET status='Inactive' WHERE id=?", [req.params.id])
  await audit(req.user.id, 'deactivate', 'custodian', req.params.id, null, req)
  res.json({ success: true })
})

app.use('/transactions', authenticate)
app.get('/transactions/stats', async (_req, res) => {
  const stats = await one("SELECT COUNT(*) totalTransactions,SUM(transaction_type='Issuance') issuances,SUM(transaction_type='Transfer') transfers,SUM(transaction_type='Return') returns,SUM(transaction_type='Disposal') disposals FROM transactions")
  res.json({ success: true, stats })
})
app.get('/transactions', async (req, res) => {
  let sql = `SELECT t.*,i.item_name,i.item_code,u.name issuer_name,cu.name custodian_name FROM transactions t
    JOIN items i ON i.id=t.item_id JOIN users u ON u.id=t.issued_by LEFT JOIN custodians c ON c.id=t.custodian_id
    LEFT JOIN users cu ON cu.id=c.user_id WHERE 1=1`
  const values = []
  if (req.query.type) { sql += ' AND t.transaction_type=?'; values.push(req.query.type) }
  sql += ' ORDER BY t.transaction_date DESC'
  const data = (await rows(sql, values)).map(record => ({
    ...record,
    items: { id: record.item_id, item_name: record.item_name, item_code: record.item_code },
    custodians: record.custodian_id ? { id: record.custodian_id, users: { name: record.custodian_name } } : null,
    issuer: { name: record.issuer_name }
  }))
  res.json({ success: true, data })
})
app.post('/transactions', requireRoles('Admin'), async (req, res) => {
  const itemId = validId(req.body.item_id)
  const custodianId = validId(req.body.custodian_id)
  const type = req.body.transaction_type
  if (!itemId || !['Issuance', 'Transfer', 'Return', 'Disposal'].includes(type)) {
    return res.status(422).json({ success: false, message: 'Valid item and transaction type are required' })
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const item = await one('SELECT * FROM items WHERE id=? FOR UPDATE', [itemId], connection)
    if (!item) throw httpError(404, 'Item not found')
    const from = validId(item.custodian_id)
    if (item.status === 'Borrowed') throw httpError(422, 'Borrowed items must be returned before another transaction')
    if (['Disposed', 'Lost'].includes(item.status) && type !== 'Return') throw httpError(422, 'Disposed or lost items cannot be transacted')
    if (['Issuance', 'Transfer'].includes(type) && !custodianId) throw httpError(422, 'A receiving custodian is required')
    if (type === 'Issuance' && from) throw httpError(422, 'Item is already assigned; use Transfer')
    if (['Transfer', 'Return'].includes(type) && !from) throw httpError(422, 'Item is not currently assigned')
    if (type === 'Transfer' && from === custodianId) throw httpError(422, 'Select a different receiving custodian')
    if (from) await connection.execute('UPDATE item_assignments SET return_date=NOW() WHERE item_id=? AND return_date IS NULL', [itemId])
    if (['Issuance', 'Transfer'].includes(type)) {
      const custodian = await one("SELECT u.name FROM custodians c JOIN users u ON u.id=c.user_id WHERE c.id=? AND c.status='Active'", [custodianId], connection)
      if (!custodian) throw httpError(422, 'Receiving custodian is not active')
      await connection.execute('INSERT INTO item_assignments (item_id,custodian_id,condition_status,notes) VALUES (?,?,?,?)', [itemId, custodianId, item.condition_status, req.body.notes || null])
      await connection.execute("UPDATE items SET custodian_id=?,assigned_to=?,status='Assigned' WHERE id=?", [custodianId, custodian.name, itemId])
    } else if (type === 'Return') {
      await connection.execute("UPDATE items SET custodian_id=NULL,assigned_to=NULL,status='Returned' WHERE id=?", [itemId])
    } else {
      await connection.execute("UPDATE items SET custodian_id=NULL,assigned_to=NULL,status='Disposed' WHERE id=?", [itemId])
    }
    const recordCustodian = ['Issuance', 'Transfer'].includes(type) ? custodianId : from
    const [result] = await connection.execute(
      'INSERT INTO transactions (item_id,custodian_id,from_custodian_id,transaction_type,issued_by,notes,par_id,ics_id) VALUES (?,?,?,?,?,?,?,?)',
      [itemId, recordCustodian, from, type, req.user.id, req.body.notes || null, req.body.par_id || null, req.body.ics_id || null]
    )
    await audit(req.user.id, 'create', 'transaction', result.insertId, { type, item_id: itemId }, req, connection)
    await connection.commit()
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/transactions/:id', (_req, res) => res.status(405).json({ success: false, message: 'Transactions are immutable; create a correcting transaction instead' }))
app.delete('/transactions/:id', (_req, res) => res.status(405).json({ success: false, message: 'Transactions are retained for audit history' }))

app.use('/borrow-requests', authenticate)
app.get('/borrow-requests', async (req, res) => {
  let sql = `SELECT r.*,i.item_name,i.item_code,i.serial_number,i.category,i.status item_status,i.condition_status item_condition,
    requester.name requester_name,reviewer.name reviewer_name,picker.name picked_up_by_name,b.status borrow_status
    FROM borrow_requests r JOIN items i ON i.id=r.item_id LEFT JOIN users requester ON requester.id=r.requester_id
    LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by LEFT JOIN users picker ON picker.id=r.picked_up_by
    LEFT JOIN borrow_records b ON b.id=r.borrow_record_id WHERE 1=1`
  const values = []
  if (!canReviewBorrowRequests(req.user)) {
    sql += ' AND r.requester_id=?'
    values.push(req.user.id)
  }
  if (req.query.status) {
    const statuses = String(req.query.status)
      .split(',')
      .map(status => status.trim())
      .filter(Boolean)
    if (statuses.length) {
      sql += ` AND r.status IN (${statuses.map(() => '?').join(',')})`
      values.push(...statuses)
    }
  }
  if (req.query.needs_action === '1') {
    sql += " AND (r.status='Pending' OR (r.status='Approved' AND r.picked_up_at IS NULL AND b.status IN ('Borrowed','Overdue')))"
  }
  if (req.query.search) {
    sql += ' AND (r.borrower_name LIKE ? OR r.borrower_reference LIKE ? OR i.item_name LIKE ? OR i.item_code LIKE ?)'
    const term = `%${req.query.search}%`
    values.push(term, term, term, term)
  }
  sql += " ORDER BY FIELD(r.status,'Pending','Approved','Picked Up','Rejected','Cancelled'),r.created_at DESC"
  res.json({ success: true, data: await rows(sql, values) })
})
app.post('/borrow-requests', async (req, res) => {
  const itemId = validId(req.body.item_id)
  const borrowerName = String(req.body.borrower_name || req.user.name || '').trim()
  const requestedBorrowDate = req.body.requested_borrow_date
  const dueDate = req.body.due_date
  const conditionOut = validConditions.has(req.body.condition_out) ? req.body.condition_out : 'Good'
  if (!itemId || !borrowerName || !requestedBorrowDate || !dueDate) {
    return res.status(422).json({ success: false, message: 'Item, borrower, borrow date, and due date are required' })
  }
  if (dueDate < requestedBorrowDate) return res.status(422).json({ success: false, message: 'Due date cannot be before the borrow date' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const item = await one('SELECT * FROM items WHERE id=? FOR UPDATE', [itemId], connection)
    if (!item) throw httpError(404, 'Item not found')
    if (!['Active', 'Returned'].includes(item.status) || item.custodian_id) throw httpError(422, 'This asset is not available for borrowing')
    const activeBorrow = await one("SELECT id FROM borrow_records WHERE item_id=? AND status IN ('Borrowed','Overdue') FOR UPDATE", [itemId], connection)
    if (activeBorrow) throw httpError(422, 'This asset already has an active borrowing record')
    const duplicateRequest = await one("SELECT id FROM borrow_requests WHERE item_id=? AND requester_id=? AND status='Pending' FOR UPDATE", [itemId, req.user.id], connection)
    if (duplicateRequest) throw httpError(422, 'You already have a pending request for this item')
    const [result] = await connection.execute(
      `INSERT INTO borrow_requests (item_id,requester_id,borrower_name,borrower_reference,department,contact_number,purpose,requested_borrow_date,due_date,condition_out,remarks,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'Pending')`,
      [itemId, req.user.id, borrowerName, req.body.borrower_reference || null, req.body.department || null, req.body.contact_number || null,
        req.body.purpose || null, requestedBorrowDate, dueDate, conditionOut, req.body.remarks || null]
    )
    await audit(req.user.id, 'request_borrow', 'borrow_request', result.insertId, { item_id: itemId, due_date: dueDate }, req, connection)
    await connection.commit()
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/borrow-requests/:id/approve', requireRoles('Admin'), async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid borrow request ID' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const request = await one('SELECT * FROM borrow_requests WHERE id=? FOR UPDATE', [id], connection)
    if (!request) throw httpError(404, 'Borrow request not found')
    if (request.status !== 'Pending') throw httpError(422, 'Only pending borrow requests can be approved')

    const item = await one('SELECT * FROM items WHERE id=? FOR UPDATE', [request.item_id], connection)
    if (!item) throw httpError(404, 'Item not found')
    if (!['Active', 'Returned'].includes(item.status) || item.custodian_id) throw httpError(422, 'This asset is no longer available for borrowing')
    const activeBorrow = await one("SELECT id FROM borrow_records WHERE item_id=? AND status IN ('Borrowed','Overdue') FOR UPDATE", [request.item_id], connection)
    if (activeBorrow) throw httpError(422, 'This asset already has an active borrowing record')

    const borrowedDate = req.body.borrowed_date || request.requested_borrow_date
    const dueDate = req.body.due_date || request.due_date
    const conditionOut = validConditions.has(req.body.condition_out) ? req.body.condition_out : request.condition_out
    if (dueDate < borrowedDate) throw httpError(422, 'Due date cannot be before the borrowed date')
    const ticketNumber = request.ticket_number || makeBorrowTicketNumber(id)

    const [borrowResult] = await connection.execute(
      `INSERT INTO borrow_records (item_id,borrower_name,borrower_reference,department,contact_number,purpose,borrowed_date,due_date,condition_out,remarks,status,recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,'Borrowed',?)`,
      [request.item_id, request.borrower_name, request.borrower_reference, request.department, request.contact_number,
        request.purpose, borrowedDate, dueDate, conditionOut, request.remarks, req.user.id]
    )
    await connection.execute("UPDATE items SET status='Borrowed',condition_status=? WHERE id=?", [conditionOut, request.item_id])
    await connection.execute(
      "UPDATE borrow_requests SET status='Approved',ticket_number=?,reviewed_by=?,reviewed_at=NOW(),review_notes=?,borrow_record_id=? WHERE id=?",
      [ticketNumber, req.user.id, req.body.review_notes || null, borrowResult.insertId, id]
    )
    await audit(req.user.id, 'approve_borrow_request', 'borrow_request', id, { item_id: request.item_id, borrowing_id: borrowResult.insertId, ticket_number: ticketNumber }, req, connection)
    await connection.commit()
    res.json({ success: true, data: { borrowing_id: borrowResult.insertId, ticket_number: ticketNumber } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/borrow-requests/:id/pickup', requireRoles('Admin'), async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid borrow request ID' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const request = await one('SELECT * FROM borrow_requests WHERE id=? FOR UPDATE', [id], connection)
    if (!request) throw httpError(404, 'Borrow request not found')
    if (request.status !== 'Approved') throw httpError(422, 'Only approved borrow requests can be marked as picked up')
    if (!request.borrow_record_id) throw httpError(422, 'Approve this request before marking the item as picked up')
    if (request.picked_up_at) throw httpError(422, 'This item was already marked as picked up')

    const record = await one('SELECT * FROM borrow_records WHERE id=? FOR UPDATE', [request.borrow_record_id], connection)
    if (!record) throw httpError(404, 'Borrowing record not found')
    if (!['Borrowed', 'Overdue'].includes(record.status)) throw httpError(422, 'This borrowing record is already closed')

    await connection.execute("UPDATE borrow_requests SET status='Picked Up',picked_up_at=NOW(),picked_up_by=? WHERE id=?", [req.user.id, id])
    await audit(req.user.id, 'mark_borrow_request_picked_up', 'borrow_request', id, { item_id: request.item_id, borrowing_id: request.borrow_record_id }, req, connection)
    await connection.commit()
    res.json({ success: true })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/borrow-requests/:id/reject', requireRoles('Admin'), async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid borrow request ID' })
  const request = await one('SELECT * FROM borrow_requests WHERE id=?', [id])
  if (!request) return res.status(404).json({ success: false, message: 'Borrow request not found' })
  if (request.status !== 'Pending') return res.status(422).json({ success: false, message: 'Only pending borrow requests can be rejected' })
  await rows("UPDATE borrow_requests SET status='Rejected',reviewed_by=?,reviewed_at=NOW(),review_notes=? WHERE id=?", [req.user.id, req.body.review_notes || null, id])
  await audit(req.user.id, 'reject_borrow_request', 'borrow_request', id, { item_id: request.item_id }, req)
  res.json({ success: true })
})
app.put('/borrow-requests/:id/cancel', async (req, res) => {
  const id = validId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: 'Invalid borrow request ID' })
  const request = await one('SELECT * FROM borrow_requests WHERE id=?', [id])
  if (!request) return res.status(404).json({ success: false, message: 'Borrow request not found' })
  if (request.status !== 'Pending') return res.status(422).json({ success: false, message: 'Only pending borrow requests can be cancelled' })
  if (request.requester_id !== req.user.id && !canReviewBorrowRequests(req.user)) {
    return res.status(403).json({ success: false, message: 'You can only cancel your own pending requests' })
  }
  await rows("UPDATE borrow_requests SET status='Cancelled',reviewed_by=?,reviewed_at=NOW(),review_notes=? WHERE id=?", [req.user.id, req.body.review_notes || null, id])
  await audit(req.user.id, 'cancel_borrow_request', 'borrow_request', id, { item_id: request.item_id }, req)
  res.json({ success: true })
})

app.use('/borrowings', authenticate)
app.get('/borrowings', async (req, res) => {
  await rows("UPDATE borrow_records SET status='Overdue' WHERE status='Borrowed' AND due_date<CURDATE()")
  let sql = `SELECT b.*,i.item_name,i.item_code,i.serial_number,u.name recorded_by_name,ru.name returned_by_name,
      r.id borrow_request_id,r.ticket_number,r.picked_up_at,r.picked_up_by,picker.name picked_up_by_name
    FROM borrow_records b JOIN items i ON i.id=b.item_id JOIN users u ON u.id=b.recorded_by
    LEFT JOIN users ru ON ru.id=b.returned_by
    LEFT JOIN borrow_requests r ON r.borrow_record_id=b.id
    LEFT JOIN users picker ON picker.id=r.picked_up_by WHERE 1=1`
  const values = []
  if (req.query.status) { sql += ' AND b.status=?'; values.push(req.query.status) }
  if (req.query.search) {
    sql += ' AND (b.borrower_name LIKE ? OR b.borrower_reference LIKE ? OR i.item_name LIKE ? OR i.item_code LIKE ?)'
    const term = `%${req.query.search}%`
    values.push(term, term, term, term)
  }
  sql += ' ORDER BY FIELD(b.status,\'Overdue\',\'Borrowed\',\'Returned\',\'Cancelled\'),b.due_date ASC,b.created_at DESC'
  res.json({ success: true, data: await rows(sql, values) })
})
app.post('/borrowings', requireRoles('Admin', 'Custodian'), async (req, res) => {
  const itemId = validId(req.body.item_id)
  const borrowerName = String(req.body.borrower_name || '').trim()
  const borrowedDate = req.body.borrowed_date
  const dueDate = req.body.due_date
  const conditionOut = validConditions.has(req.body.condition_out) ? req.body.condition_out : 'Good'
  if (!itemId || !borrowerName || !borrowedDate || !dueDate) {
    return res.status(422).json({ success: false, message: 'Item, borrower, borrowed date, and due date are required' })
  }
  if (dueDate < borrowedDate) return res.status(422).json({ success: false, message: 'Due date cannot be before the borrowed date' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const item = await one('SELECT * FROM items WHERE id=? FOR UPDATE', [itemId], connection)
    if (!item) throw httpError(404, 'Item not found')
    if (!['Active', 'Returned'].includes(item.status) || item.custodian_id) throw httpError(422, 'This asset is not available for borrowing')
    const activeBorrow = await one("SELECT id FROM borrow_records WHERE item_id=? AND status IN ('Borrowed','Overdue') FOR UPDATE", [itemId], connection)
    if (activeBorrow) throw httpError(422, 'This asset already has an active borrowing record')
    const [result] = await connection.execute(
      `INSERT INTO borrow_records (item_id,borrower_name,borrower_reference,department,contact_number,purpose,borrowed_date,due_date,condition_out,remarks,status,recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,'Borrowed',?)`,
      [itemId, borrowerName, req.body.borrower_reference || null, req.body.department || null, req.body.contact_number || null,
        req.body.purpose || null, borrowedDate, dueDate, conditionOut, req.body.remarks || null, req.user.id]
    )
    await connection.execute("UPDATE items SET status='Borrowed',condition_status=? WHERE id=?", [conditionOut, itemId])
    await audit(req.user.id, 'borrow', 'borrowing', result.insertId, { item_id: itemId, borrower: borrowerName, due_date: dueDate }, req, connection)
    await connection.commit()
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})
app.put('/borrowings/:id/return', requireRoles('Admin', 'Custodian'), async (req, res) => {
  const id = validId(req.params.id)
  const conditionReturn = validConditions.has(req.body.condition_return) ? req.body.condition_return : 'Good'
  if (!id) return res.status(400).json({ success: false, message: 'Invalid borrowing record ID' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const record = await one('SELECT * FROM borrow_records WHERE id=? FOR UPDATE', [id], connection)
    if (!record) throw httpError(404, 'Borrowing record not found')
    if (!['Borrowed', 'Overdue'].includes(record.status)) throw httpError(422, 'This borrowing record is already closed')
    await connection.execute(
      "UPDATE borrow_records SET status='Returned',returned_date=NOW(),condition_return=?,remarks=COALESCE(?,remarks),returned_by=? WHERE id=?",
      [conditionReturn, req.body.remarks || null, req.user.id, id]
    )
    const nextStatus = ['Damaged', 'Under Repair'].includes(conditionReturn) ? 'In Repair' : 'Active'
    await connection.execute('UPDATE items SET status=?,condition_status=? WHERE id=?', [nextStatus, conditionReturn, record.item_id])
    await audit(req.user.id, 'return_borrowed', 'borrowing', id, { item_id: record.item_id, condition: conditionReturn }, req, connection)
    await connection.commit()
    res.json({ success: true })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
})

app.use('/maintenance', authenticate)
app.get('/maintenance', async (req, res) => {
  let sql = 'SELECT m.*,i.item_name,i.item_code,u.name created_by_name FROM maintenance_records m JOIN items i ON i.id=m.item_id JOIN users u ON u.id=m.created_by'
  const values = []
  if (req.query.status) { sql += ' WHERE m.status=?'; values.push(req.query.status) }
  sql += ' ORDER BY m.scheduled_date DESC'
  res.json({ success: true, data: await rows(sql, values) })
})
app.post('/maintenance', requireRoles('Admin', 'Custodian'), async (req, res) => {
  const result = await rows('INSERT INTO maintenance_records (item_id,custodian_id,maintenance_type,scheduled_date,cost,notes,status,created_by) VALUES (?,?,?,?,?,?,?,?)',
    [req.body.item_id, validId(req.body.custodian_id), String(req.body.maintenance_type || '').trim(), req.body.scheduled_date, req.body.cost || 0, req.body.notes || null, req.body.status || 'Pending', req.user.id])
  await audit(req.user.id, 'create', 'maintenance', result.insertId, null, req)
  res.status(201).json({ success: true, data: { id: result.insertId } })
})
app.put('/maintenance/:id', requireRoles('Admin', 'Custodian'), async (req, res) => {
  const status = req.body.status || 'Pending'
  await rows("UPDATE maintenance_records SET status=?,completed_date=IF(?='Completed',CURDATE(),completed_date),notes=COALESCE(?,notes) WHERE id=?", [status, status, req.body.notes || null, req.params.id])
  await audit(req.user.id, 'update', 'maintenance', req.params.id, { status }, req)
  res.json({ success: true })
})

app.use('/verifications', authenticate)
app.get('/verifications', async (_req, res) => {
  const data = await rows(`SELECT v.*,u.name verified_by_name,cu.name custodian_name FROM inventory_verifications v
    JOIN users u ON u.id=v.verified_by JOIN custodians c ON c.id=v.custodian_id JOIN users cu ON cu.id=c.user_id
    ORDER BY v.verification_date DESC`)
  res.json({ success: true, data: data.map(record => ({ ...record, discrepancies: parseJson(record.discrepancies, []) })) })
})
app.post('/verifications', requireRoles('Admin', 'Auditor'), async (req, res) => {
  const expected = Math.max(0, Number.parseInt(req.body.total_items_expected || 0, 10))
  const found = Math.max(0, Number.parseInt(req.body.items_found || 0, 10))
  const missing = Math.max(0, expected - found)
  const status = missing > 0 ? 'Needs Review' : 'Completed'
  const result = await rows('INSERT INTO inventory_verifications (custodian_id,total_items_expected,items_found,items_missing,discrepancies,status,verified_by) VALUES (?,?,?,?,?,?,?)',
    [req.body.custodian_id, expected, found, missing, JSON.stringify(req.body.discrepancies || []), status, req.user.id])
  await rows('UPDATE custodians SET last_verification=NOW() WHERE id=?', [req.body.custodian_id])
  await audit(req.user.id, 'create', 'verification', result.insertId, null, req)
  res.status(201).json({ success: true, data: { id: result.insertId } })
})

app.use('/preferences', authenticate)
app.get('/preferences', async (req, res) => {
  let data = await one('SELECT * FROM user_preferences WHERE user_id=?', [req.user.id])
  if (!data) {
    await rows('INSERT INTO user_preferences (user_id) VALUES (?)', [req.user.id])
    data = await one('SELECT * FROM user_preferences WHERE user_id=?', [req.user.id])
  }
  res.json({ success: true, data })
})
app.put('/preferences', async (req, res) => {
  const fields = ['email_notifications', 'system_notifications', 'activity_log', 'item_updates', 'transaction_alerts', 'weekly_reports']
  await rows(`UPDATE user_preferences SET ${fields.map(field => `${field}=?`).join(',')} WHERE user_id=?`, [...fields.map(field => req.body[field] ? 1 : 0), req.user.id])
  await audit(req.user.id, 'update', 'preferences', req.user.id, null, req)
  res.json({ success: true })
})

app.get('/profile', authenticate, async (req, res) => {
  const preferences = await one('SELECT * FROM user_preferences WHERE user_id=?', [req.user.id]) || {}
  const activityLog = await rows('SELECT action,entity_type,entity_id,details,ip_address,created_at FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 100', [req.user.id])
  const normalizedActivity = activityLog.map(entry => ({ ...entry, details: parseJson(entry.details) }))
  const loginHistory = normalizedActivity.filter(entry => entry.action === 'login')
  res.json({ success: true, data: {
    profile: req.user,
    preferences,
    loginHistory,
    activityLog: normalizedActivity,
    security: { last_login: loginHistory[0]?.created_at || null, active_sessions: 1, two_factor_enabled: false }
  } })
})

app.get('/reports', authenticate, async (req, res) => {
  const requestedPeriod = String(req.query.period || '').toLowerCase()
  const analyticsPeriod = ['daily', 'weekly', 'monthly'].includes(requestedPeriod) ? requestedPeriod : 'monthly'
  const trendStartDate = new Date()
  trendStartDate.setHours(0, 0, 0, 0)

  let trendBucketSql = "DATE_FORMAT(transaction_date,'%Y-%m')"
  if (analyticsPeriod === 'daily') {
    trendStartDate.setDate(trendStartDate.getDate() - 6)
    trendBucketSql = "DATE_FORMAT(transaction_date,'%Y-%m-%d')"
  } else if (analyticsPeriod === 'weekly') {
    const mondayOffset = (trendStartDate.getDay() + 6) % 7
    trendStartDate.setDate(trendStartDate.getDate() - mondayOffset - 49)
    trendBucketSql = "DATE_FORMAT(DATE_SUB(DATE(transaction_date), INTERVAL WEEKDAY(transaction_date) DAY),'%Y-%m-%d')"
  } else {
    trendStartDate.setDate(1)
    trendStartDate.setMonth(trendStartDate.getMonth() - 11)
  }

  const trendStart = `${trendStartDate.getFullYear()}-${String(trendStartDate.getMonth() + 1).padStart(2, '0')}-${String(trendStartDate.getDate()).padStart(2, '0')}`
  const borrowTrendBucketSql = trendBucketSql.replaceAll('transaction_date', 'borrowed_date')

  const [items, custodians, transactions, maintenance, categories, statuses, transactionTrend, borrowingTrend] = await Promise.all([
    one("SELECT COUNT(*) totalItems,COALESCE(SUM(total_cost),0) totalValue,SUM(status IN ('Active','Assigned')) activeCount,SUM(condition_status='Damaged') damageCount,SUM(custodian_id IS NULL AND status<>'Disposed') notDistributedCount,SUM(custodian_id IS NOT NULL AND status<>'Disposed') assignedCount FROM items"),
    one("SELECT COUNT(*) totalCustodians,SUM(status='Active') activeCustodians,SUM(status='Inactive') inactiveCustodians FROM custodians"),
    one("SELECT COUNT(*) totalTransactions,SUM(transaction_type='Issuance') issuances,SUM(transaction_type='Transfer') transfers,SUM(transaction_type='Return') returns,SUM(transaction_type='Disposal') disposals FROM transactions"),
    one("SELECT COUNT(*) total,SUM(status='Pending') pending,SUM(status='Completed') completed FROM maintenance_records"),
    rows('SELECT category label,COUNT(*) value FROM items GROUP BY category ORDER BY value DESC,category ASC'),
    rows('SELECT status label,COUNT(*) value FROM items GROUP BY status ORDER BY value DESC,status ASC'),
    rows(`SELECT ${trendBucketSql} month,COUNT(*) total,SUM(transaction_type='Issuance') issuances,SUM(transaction_type='Transfer') transfers,SUM(transaction_type='Return') returns_count,SUM(transaction_type='Disposal') disposals FROM transactions WHERE transaction_date>=? GROUP BY ${trendBucketSql} ORDER BY month ASC`, [trendStart]),
    rows(`SELECT ${borrowTrendBucketSql} month,COUNT(*) borrowings FROM borrow_records WHERE borrowed_date>=? GROUP BY ${borrowTrendBucketSql} ORDER BY month ASC`, [trendStart])
  ])
  const trendMap = new Map(transactionTrend.map(record => [record.month, { ...record, borrowings: 0 }]))
  borrowingTrend.forEach(record => {
    const current = trendMap.get(record.month) || { month: record.month, total: 0, issuances: 0, transfers: 0, returns_count: 0, disposals: 0 }
    current.borrowings = Number(record.borrowings || 0)
    current.total = Number(current.total || 0) + Number(record.borrowings || 0)
    trendMap.set(record.month, current)
  })
  res.json({ success: true, data: { items, custodians, transactions, maintenance, analytics: { categories, statuses, transaction_trend: Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month)), period: analyticsPeriod }, generated_at: new Date().toISOString() } })
})

app.use('/documents', authenticate)
app.get('/documents', async (req, res) => {
  const sql = `SELECT d.*,u.name generated_by_name FROM generated_documents d JOIN users u ON u.id=d.generated_by${req.user.role === 'Custodian' ? ' WHERE d.generated_by=?' : ''} ORDER BY d.created_at DESC LIMIT 250`
  const data = await rows(sql, req.user.role === 'Custodian' ? [req.user.id] : [])
  res.json({ success: true, data: data.map(record => ({ ...record, metadata: parseJson(record.metadata, {}) })) })
})
app.post('/documents', async (req, res) => {
  const result = await rows('INSERT INTO generated_documents (template_name,worksheet_name,output_name,document_type,generated_by,metadata) VALUES (?,?,?,?,?,?)',
    [String(req.body.template_name || '').trim(), req.body.worksheet_name || null, String(req.body.output_name || '').trim(), req.body.document_type || 'xlsx', req.user.id, JSON.stringify(req.body.metadata || {})])
  await audit(req.user.id, 'generate', 'document', result.insertId, { template: req.body.template_name }, req)
  res.status(201).json({ success: true, data: { id: result.insertId } })
})

app.get('/audit-logs', authenticate, requireRoles('Admin', 'Auditor'), async (_req, res) => {
  const data = await rows('SELECT a.*,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 250')
  res.json({ success: true, data: data.map(record => ({ ...record, details: parseJson(record.details) })) })
})

app.use('/attachments', authenticate)
app.get('/attachments/:id/content', async (req, res) => {
  const file = await one('SELECT * FROM asset_attachments WHERE id=?', [req.params.id])
  if (!file) return res.status(404).json({ success: false, message: 'Attachment not found' })
  const filePath = path.join(attachmentDirectory, file.stored_name)
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Stored file is missing' })
  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Length', file.file_size)
  res.setHeader('Content-Disposition', `${file.mime_type.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.original_name)}"`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  fs.createReadStream(filePath).pipe(res)
})
app.get('/attachments', async (req, res) => {
  const itemId = validId(req.query.item_id)
  if (!itemId) return res.status(422).json({ success: false, message: 'Item ID is required' })
  const data = await rows(`SELECT a.id,a.item_id,a.original_name,a.mime_type,a.file_size,a.attachment_type,a.created_at,u.name uploaded_by_name
    FROM asset_attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.item_id=? ORDER BY a.created_at DESC`, [itemId])
  res.json({ success: true, data })
})
app.post('/attachments', requireRoles('Admin', 'Custodian'), upload.single('file'), async (req, res) => {
  const itemId = validId(req.body.item_id)
  if (!itemId || !req.file) return res.status(422).json({ success: false, message: 'Item and file are required' })
  if (!allowedMimeTypes.has(req.file.mimetype)) return res.status(422).json({ success: false, message: 'Unsupported file type' })
  await fs.promises.mkdir(attachmentDirectory, { recursive: true })
  const extension = path.extname(req.file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')
  const storedName = `${crypto.randomBytes(24).toString('hex')}${extension}`
  const destination = path.join(attachmentDirectory, storedName)
  await fs.promises.writeFile(destination, req.file.buffer, { flag: 'wx' })
  try {
    const type = req.file.mimetype.startsWith('image/') ? 'Photo' : 'Document'
    const result = await rows('INSERT INTO asset_attachments (item_id,original_name,stored_name,mime_type,file_size,attachment_type,uploaded_by) VALUES (?,?,?,?,?,?,?)',
      [itemId, path.basename(req.file.originalname), storedName, req.file.mimetype, req.file.size, type, req.user.id])
    await audit(req.user.id, 'upload', 'attachment', result.insertId, { item_id: itemId, name: req.file.originalname }, req)
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (error) {
    await fs.promises.unlink(destination).catch(() => {})
    throw error
  }
})
app.delete('/attachments/:id', requireRoles('Admin'), async (req, res) => {
  const file = await one('SELECT stored_name,item_id FROM asset_attachments WHERE id=?', [req.params.id])
  if (!file) return res.status(404).json({ success: false, message: 'Attachment not found' })
  await rows('DELETE FROM asset_attachments WHERE id=?', [req.params.id])
  await fs.promises.unlink(path.join(attachmentDirectory, file.stored_name)).catch(() => {})
  await audit(req.user.id, 'delete', 'attachment', req.params.id, { item_id: file.item_id }, req)
  res.json({ success: true })
})

app.use((_req, res) => res.status(404).json({ success: false, message: 'API endpoint not found' }))

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(422).json({ success: false, message: 'Files must not exceed 10 MB' })
  }
  const duplicate = error?.code === 'ER_DUP_ENTRY'
  const status = error.status || (duplicate ? 409 : 500)
  const message = duplicate ? 'A record with that unique value already exists' : (status < 500 ? error.message : 'Database operation failed')
  res.status(status).json({ success: false, message })
})

await ensureDatabaseSchema()

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`CPMS Node API running at http://127.0.0.1:${port}`)
})

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
