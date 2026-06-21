<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$email = strtolower(trim((string)(getenv('CPMS_ADMIN_EMAIL') ?: '')));
$password = (string)(getenv('CPMS_ADMIN_PASSWORD') ?: '');
$name = trim((string)(getenv('CPMS_ADMIN_NAME') ?: 'System Administrator'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
    fwrite(STDERR, "Set CPMS_ADMIN_EMAIL and CPMS_ADMIN_PASSWORD (minimum 12 characters).\n");
    exit(1);
}

$pdo = db();
$pdo->beginTransaction();
$stmt = $pdo->prepare(
    'INSERT INTO users (name, email, password_hash, role, status)
     VALUES (?, ?, ?, "Admin", "Active")
     ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role="Admin", status="Active"'
);
$stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
$userId = (int)$stmt->fetchColumn();
$pdo->prepare('INSERT IGNORE INTO user_preferences (user_id) VALUES (?)')->execute([$userId]);
$pdo->commit();

fwrite(STDOUT, "Administrator account created or updated.\n");
