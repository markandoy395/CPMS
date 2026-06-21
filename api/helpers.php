<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        respond(['success' => false, 'message' => 'Invalid JSON request body'], 400);
    }
    return $body;
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    return preg_match('/^Bearer\s+(.+)$/i', $header, $matches) ? trim($matches[1]) : null;
}

function current_user(bool $required = true): ?array
{
    $token = bearer_token();
    if (!$token) {
        if ($required) respond(['success' => false, 'message' => 'Authentication required'], 401);
        return null;
    }

    $stmt = db()->prepare(
        'SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address, u.city,
                u.state, u.country, u.postal_code, u.bio, u.created_at
         FROM auth_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.status = "Active"'
    );
    $stmt->execute([hash('sha256', $token)]);
    $user = $stmt->fetch();
    if (!$user && $required) respond(['success' => false, 'message' => 'Session expired'], 401);
    return $user ?: null;
}

function require_roles(array $roles): array
{
    $user = current_user();
    if (!in_array($user['role'], $roles, true)) {
        respond(['success' => false, 'message' => 'You do not have permission for this action'], 403);
    }
    return $user;
}

function audit(?int $userId, string $action, string $entityType, $entityId = null, array $details = []): void
{
    $stmt = db()->prepare(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $action,
        $entityType,
        $entityId === null ? null : (string)$entityId,
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}

function clean_user(array $user): array
{
    unset($user['password_hash']);
    return $user;
}

function id_segment(array $segments, int $index): int
{
    $value = $segments[$index] ?? '';
    if (!ctype_digit((string)$value) || (int)$value < 1) {
        respond(['success' => false, 'message' => 'Invalid resource ID'], 400);
    }
    return (int)$value;
}

function placeholders(int $count): string
{
    return implode(', ', array_fill(0, $count, '?'));
}
