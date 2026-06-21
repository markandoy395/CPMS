import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { one, pool, rows } from './db.js'

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function bearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')
  return match?.[1]?.trim() || null
}

export function cleanUser(user) {
  if (!user) return user
  const { password_hash: _passwordHash, ...safeUser } = user
  return safeUser
}

export async function verifyPassword(password, hash) {
  const normalizedHash = hash?.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash
  return Boolean(normalizedHash) && bcrypt.compare(password, normalizedHash)
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function audit(userId, action, entityType, entityId = null, details = null, req = null, executor = pool) {
  await rows(
    'INSERT INTO audit_logs (user_id,action,entity_type,entity_id,details,ip_address) VALUES (?,?,?,?,?,?)',
    [userId, action, entityType, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, req?.ip || null],
    executor
  )
}

export async function authenticate(req, res, next) {
  try {
    const token = bearerToken(req)
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' })
    const user = await one(
      `SELECT u.id,u.name,u.email,u.role,u.status,u.phone,u.address,u.city,u.state,u.country,u.postal_code,u.bio,u.created_at
       FROM auth_tokens t JOIN users u ON u.id=t.user_id
       WHERE t.token_hash=? AND t.expires_at>NOW() AND u.status='Active'`,
      [sha256(token)]
    )
    if (!user) return res.status(401).json({ success: false, message: 'Session expired' })
    req.user = user
    req.authToken = token
    next()
  } catch (error) {
    next(error)
  }
}

export async function optionalAuthenticate(req, _res, next) {
  try {
    const token = bearerToken(req)
    if (token) {
      req.user = await one(
        `SELECT u.id,u.name,u.email,u.role,u.status,u.phone,u.address,u.city,u.state,u.country,u.postal_code,u.bio,u.created_at
         FROM auth_tokens t JOIN users u ON u.id=t.user_id
         WHERE t.token_hash=? AND t.expires_at>NOW() AND u.status='Active'`,
        [sha256(token)]
      )
      req.authToken = token
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => req.user?.role === 'Super Admin' || roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ success: false, message: 'You do not have permission for this action' })
}

export function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}
