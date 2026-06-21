<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '', '/');
    if (str_contains($path, 'api/')) {
        $path = substr($path, strpos($path, 'api/') + 4);
    }
    $segments = array_values(array_filter(explode('/', $path), 'strlen'));
    $resource = $segments[0] ?? '';

    if ($resource === 'health') {
        db()->query('SELECT 1');
        respond(['success' => true, 'status' => 'ok', 'database' => 'connected']);
    }

    if ($resource === 'auth') {
        handle_auth($method, $segments);
    }

    if ($resource === 'users') {
        handle_users($method, $segments);
    }

    if ($resource === 'items') {
        handle_items($method, $segments);
    }

    if ($resource === 'custodians') {
        handle_custodians($method, $segments);
    }

    if ($resource === 'transactions') {
        handle_transactions($method, $segments);
    }

    if ($resource === 'maintenance') {
        handle_maintenance($method, $segments);
    }

    if ($resource === 'verifications') {
        handle_verifications($method, $segments);
    }

    if ($resource === 'preferences') {
        handle_preferences($method);
    }

    if ($resource === 'profile') {
        handle_profile($method);
    }

    if ($resource === 'reports') {
        handle_reports($method);
    }

    if ($resource === 'documents') {
        handle_documents($method);
    }

    if ($resource === 'attachments') {
        handle_attachments($method, $segments);
    }

    if ($resource === 'audit-logs') {
        $user = require_roles(['Admin', 'Auditor']);
        $rows = db()->query(
            'SELECT a.*, u.name AS user_name FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 250'
        )->fetchAll();
        respond(['success' => true, 'data' => $rows]);
    }

    respond(['success' => false, 'message' => 'API endpoint not found'], 404);
} catch (PDOException $error) {
    error_log($error->getMessage());
    $message = str_contains($error->getMessage(), 'Duplicate entry')
        ? 'A record with that unique value already exists'
        : 'Database operation failed';
    respond(['success' => false, 'message' => $message], 500);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['success' => false, 'message' => $error->getMessage()], 500);
}

function handle_auth(string $method, array $segments): never
{
    $action = $segments[1] ?? '';
    $body = request_body();

    if ($method === 'POST' && $action === 'login') {
        $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([strtolower(trim((string)($body['email'] ?? '')))]);
        $user = $stmt->fetch();
        if (!$user || $user['status'] !== 'Active' || !password_verify((string)($body['password'] ?? ''), $user['password_hash'])) {
            respond(['success' => false, 'message' => 'Invalid email or password'], 401);
        }
        $token = bin2hex(random_bytes(32));
        $stmt = db()->prepare('INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))');
        $stmt->execute([$user['id'], hash('sha256', $token)]);
        audit((int)$user['id'], 'login', 'auth', $user['id']);
        respond(['success' => true, 'user' => clean_user($user), 'token' => $token]);
    }

    if ($method === 'POST' && $action === 'signup') {
        $name = trim((string)($body['name'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            respond(['success' => false, 'message' => 'Name, valid email, and an 8-character password are required'], 422);
        }
        db()->beginTransaction();
        $stmt = db()->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "Custodian")');
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = (int)db()->lastInsertId();
        db()->prepare('INSERT INTO custodians (user_id, department) VALUES (?, "Unassigned")')->execute([$userId]);
        db()->prepare('INSERT INTO user_preferences (user_id) VALUES (?)')->execute([$userId]);
        db()->commit();
        audit($userId, 'signup', 'user', $userId);
        respond(['success' => true, 'message' => 'Account created. An administrator can update your department.'], 201);
    }

    if ($method === 'GET' && $action === 'me') {
        respond(['success' => true, 'user' => current_user()]);
    }

    if ($method === 'POST' && $action === 'logout') {
        $user = current_user(false);
        $token = bearer_token();
        if ($token) db()->prepare('DELETE FROM auth_tokens WHERE token_hash = ?')->execute([hash('sha256', $token)]);
        if ($user) audit((int)$user['id'], 'logout', 'auth', $user['id']);
        respond(['success' => true]);
    }

    if ($method === 'PUT' && $action === 'profile') {
        $user = current_user();
        $name = trim((string)($body['name'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['success' => false, 'message' => 'Valid name and email are required'], 422);
        }
        db()->prepare(
            'UPDATE users SET name=?, email=?, phone=?, address=?, city=?, state=?, country=?, postal_code=?, bio=? WHERE id=?'
        )->execute([$name, $email, $body['phone']??null, $body['address']??null, $body['city']??null,
            $body['state']??null, $body['country']??null, $body['postal_code']??null, $body['bio']??null, $user['id']]);
        audit((int)$user['id'], 'update', 'profile', $user['id']);
        $stmt = db()->prepare('SELECT id,name,email,role,status,phone,address,city,state,country,postal_code,bio,created_at FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        respond(['success' => true, 'user' => $stmt->fetch()]);
    }

    if ($method === 'POST' && $action === 'password') {
        $user = current_user();
        $current = (string)($body['current_password'] ?? '');
        $next = (string)($body['new_password'] ?? '');
        $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $hash = $stmt->fetchColumn();
        if (!password_verify($current, (string)$hash)) {
            respond(['success' => false, 'message' => 'Current password is incorrect'], 422);
        }
        if (strlen($next) < 8) respond(['success' => false, 'message' => 'New password must contain at least 8 characters'], 422);
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
        db()->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND token_hash <> ?')->execute([$user['id'], hash('sha256', bearer_token() ?? '')]);
        audit((int)$user['id'], 'change_password', 'user', $user['id']);
        respond(['success' => true]);
    }

    respond(['success' => false, 'message' => 'Auth endpoint not found'], 404);
}

function handle_users(string $method, array $segments): never
{
    $admin = require_roles(['Admin']);
    $body = request_body();
    $id = isset($segments[1]) ? id_segment($segments, 1) : null;

    if ($method === 'GET' && $id === null) {
        $rows = db()->query('SELECT id, name, email, role, status, created_at, updated_at FROM users ORDER BY created_at DESC')->fetchAll();
        respond(['success' => true, 'data' => $rows]);
    }
    if ($method === 'POST') {
        $role = in_array($body['role'] ?? '', ['Admin', 'Custodian', 'Auditor'], true) ? $body['role'] : 'Custodian';
        if (!filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL) || strlen((string)($body['password'] ?? '')) < 8) {
            respond(['success' => false, 'message' => 'Valid email and an 8-character password are required'], 422);
        }
        db()->beginTransaction();
        $stmt = db()->prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([trim((string)$body['name']), strtolower(trim((string)$body['email'])), password_hash((string)$body['password'], PASSWORD_DEFAULT), $role, $body['status'] ?? 'Active']);
        $newId = (int)db()->lastInsertId();
        db()->prepare('INSERT INTO user_preferences (user_id) VALUES (?)')->execute([$newId]);
        if ($role === 'Custodian') {
            db()->prepare('INSERT INTO custodians (user_id, department) VALUES (?, ?)')->execute([$newId, trim((string)($body['department'] ?? 'Unassigned'))]);
        }
        db()->commit();
        audit((int)$admin['id'], 'create', 'user', $newId, ['role' => $role]);
        respond(['success' => true, 'data' => ['id' => $newId]], 201);
    }
    if ($method === 'PUT' && $id !== null) {
        $role = in_array($body['role'] ?? '', ['Admin', 'Custodian', 'Auditor'], true) ? $body['role'] : 'Custodian';
        $status = ($body['status'] ?? '') === 'Inactive' ? 'Inactive' : 'Active';
        db()->prepare('UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?')
            ->execute([trim((string)$body['name']), strtolower(trim((string)$body['email'])), $role, $status, $id]);
        if (!empty($body['password'])) {
            if (strlen((string)$body['password']) < 8) respond(['success' => false, 'message' => 'Password must contain at least 8 characters'], 422);
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash((string)$body['password'], PASSWORD_DEFAULT), $id]);
        }
        audit((int)$admin['id'], 'update', 'user', $id, ['role' => $role, 'status' => $status]);
        respond(['success' => true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        if ((int)$admin['id'] === $id) respond(['success' => false, 'message' => 'You cannot deactivate your own account'], 422);
        db()->prepare('UPDATE users SET status = "Inactive" WHERE id = ?')->execute([$id]);
        db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$id]);
        audit((int)$admin['id'], 'deactivate', 'user', $id);
        respond(['success' => true]);
    }
    respond(['success' => false, 'message' => 'User endpoint not found'], 404);
}

function item_columns(): array
{
    return ['item_name','description','category','subcategory','item_code','serial_number','model_number','brand','purchase_date','po_number','vendor','invoice_number','unit_cost','total_cost','funding_source','campus','building','room_number','department','assigned_to','custodian_id','asset_type','quantity','condition_status','warranty_expiry','maintenance_schedule','insurance_policy','status'];
}

function handle_items(string $method, array $segments): never
{
    $user = current_user();
    $id = isset($segments[1]) && ctype_digit((string)$segments[1]) ? (int)$segments[1] : null;
    if ($method === 'GET' && ($segments[1] ?? '') === 'stats') {
        $row = db()->query(
            'SELECT COUNT(*) totalItems, COALESCE(SUM(total_cost),0) totalValue,
             SUM(status IN ("Active","Assigned")) activeCount,
             SUM(condition_status = "Damaged") damageCount,
             SUM(custodian_id IS NULL AND status <> "Disposed") notDistributedCount FROM items'
        )->fetch();
        respond(['success' => true, 'stats' => array_map('floatval', $row)]);
    }
    if ($method === 'GET' && $id === null) {
        $sql = 'SELECT i.*, i.condition_status AS `condition`, u.name AS assigned_to_name FROM items i
                LEFT JOIN custodians c ON c.id = i.custodian_id LEFT JOIN users u ON u.id = c.user_id WHERE 1=1';
        $values = [];
        if (!empty($_GET['search'])) { $sql .= ' AND (i.item_name LIKE ? OR i.item_code LIKE ? OR i.serial_number LIKE ?)'; $term = '%' . $_GET['search'] . '%'; array_push($values, $term, $term, $term); }
        if (!empty($_GET['category'])) { $sql .= ' AND i.category = ?'; $values[] = $_GET['category']; }
        if (!empty($_GET['status'])) { $sql .= ' AND i.status = ?'; $values[] = $_GET['status']; }
        $sql .= ' ORDER BY i.created_at DESC';
        $stmt = db()->prepare($sql); $stmt->execute($values);
        respond(['success' => true, 'data' => $stmt->fetchAll()]);
    }
    if ($method === 'GET' && $id !== null) {
        $stmt = db()->prepare('SELECT *, condition_status AS `condition` FROM items WHERE id = ?'); $stmt->execute([$id]);
        $item = $stmt->fetch();
        respond($item ? ['success' => true, 'data' => $item] : ['success' => false, 'message' => 'Item not found'], $item ? 200 : 404);
    }
    require_roles($method === 'POST' ? ['Admin', 'Custodian'] : ['Admin']);
    $body = request_body();
    $columns = item_columns();
    $values = array_map(function($column) use ($body) {
        $value = $column === 'condition_status' ? ($body['condition'] ?? 'New') : ($body[$column] ?? null);
        if (in_array($column, ['purchase_date', 'warranty_expiry'], true) && $value === '') return null;
        if ($column === 'custodian_id') return is_numeric($value) && (int)$value > 0 ? (int)$value : null;
        if ($column === 'quantity') return max(1, (int)($value ?? 1));
        if (in_array($column, ['unit_cost', 'total_cost'], true)) return max(0, (float)($value ?? 0));
        return $value;
    }, $columns);
    if ($method === 'POST') {
        $stmt = db()->prepare('INSERT INTO items (' . implode(',', $columns) . ') VALUES (' . placeholders(count($columns)) . ')');
        $stmt->execute($values); $newId = (int)db()->lastInsertId();
        audit((int)$user['id'], 'create', 'item', $newId, ['item_code' => $body['item_code'] ?? null]);
        respond(['success' => true, 'data' => ['id' => $newId]], 201);
    }
    if ($method === 'PUT' && $id !== null) {
        $assignments = implode(', ', array_map(fn($column) => "{$column} = ?", $columns));
        $values[] = $id;
        db()->prepare("UPDATE items SET {$assignments} WHERE id = ?")->execute($values);
        audit((int)$user['id'], 'update', 'item', $id);
        respond(['success' => true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        $stmt = db()->prepare('SELECT COUNT(*) FROM transactions WHERE item_id = ?'); $stmt->execute([$id]);
        if ((int)$stmt->fetchColumn() > 0) respond(['success' => false, 'message' => 'Items with transaction history cannot be deleted'], 422);
        db()->prepare('DELETE FROM items WHERE id = ?')->execute([$id]);
        audit((int)$user['id'], 'delete', 'item', $id);
        respond(['success' => true]);
    }
    respond(['success' => false, 'message' => 'Item endpoint not found'], 404);
}

function handle_custodians(string $method, array $segments): never
{
    $user = current_user();
    if (($segments[1] ?? '') === 'stats' && $method === 'GET') {
        $row = db()->query('SELECT COUNT(*) totalCustodians, SUM(status="Active") activeCustodians, SUM(status="Inactive") inactiveCustodians FROM custodians')->fetch();
        respond(['success' => true, 'stats' => array_map('intval', $row)]);
    }
    $id = isset($segments[1]) && ctype_digit((string)$segments[1]) ? (int)$segments[1] : null;
    if ($method === 'GET' && $id === null) {
        $sql = 'SELECT c.*, u.name, u.email, COUNT(i.id) total_items FROM custodians c JOIN users u ON u.id=c.user_id LEFT JOIN items i ON i.custodian_id=c.id WHERE 1=1';
        $values = [];
        if (!empty($_GET['status'])) { $sql .= ' AND c.status=?'; $values[]=$_GET['status']; }
        if (!empty($_GET['search'])) { $sql .= ' AND (u.name LIKE ? OR u.email LIKE ? OR c.department LIKE ?)'; $term='%'.$_GET['search'].'%'; array_push($values,$term,$term,$term); }
        $sql .= ' GROUP BY c.id ORDER BY c.created_at DESC';
        $stmt=db()->prepare($sql); $stmt->execute($values);
        $rows=array_map(function($row){$row['users']=['id'=>$row['user_id'],'name'=>$row['name'],'email'=>$row['email']]; unset($row['name'],$row['email']); return $row;},$stmt->fetchAll());
        respond(['success'=>true,'data'=>$rows]);
    }
    if ($method === 'GET' && $id !== null) {
        $stmt=db()->prepare('SELECT c.*,u.name,u.email FROM custodians c JOIN users u ON u.id=c.user_id WHERE c.id=?');$stmt->execute([$id]);$row=$stmt->fetch();
        respond($row?['success'=>true,'data'=>$row]:['success'=>false,'message'=>'Custodian not found'],$row?200:404);
    }
    require_roles(['Admin']);
    $body=request_body();
    if ($method === 'POST') {
        $stmt=db()->prepare('INSERT INTO custodians (user_id,department,position,contact_number,status) VALUES (?,?,?,?,?)');
        $stmt->execute([$body['user_id'],trim((string)$body['department']),$body['position']??null,$body['contact_number']??null,$body['status']??'Active']);
        $newId=(int)db()->lastInsertId(); audit((int)$user['id'],'create','custodian',$newId); respond(['success'=>true,'data'=>['id'=>$newId]],201);
    }
    if ($method === 'PUT' && $id !== null) {
        db()->prepare('UPDATE custodians SET user_id=?,department=?,position=?,contact_number=?,status=? WHERE id=?')->execute([$body['user_id'],trim((string)$body['department']),$body['position']??null,$body['contact_number']??null,$body['status']??'Active',$id]);
        audit((int)$user['id'],'update','custodian',$id); respond(['success'=>true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        $stmt=db()->prepare('SELECT COUNT(*) FROM items WHERE custodian_id=?');$stmt->execute([$id]);
        if((int)$stmt->fetchColumn()>0) respond(['success'=>false,'message'=>'Return or transfer assigned items before deactivating this custodian'],422);
        db()->prepare('UPDATE custodians SET status="Inactive" WHERE id=?')->execute([$id]); audit((int)$user['id'],'deactivate','custodian',$id); respond(['success'=>true]);
    }
    respond(['success'=>false,'message'=>'Custodian endpoint not found'],404);
}

function handle_transactions(string $method, array $segments): never
{
    $user=current_user();
    if ($method === 'GET' && ($segments[1] ?? '') === 'stats') {
        $row=db()->query('SELECT COUNT(*) totalTransactions,SUM(transaction_type="Issuance") issuances,SUM(transaction_type="Transfer") transfers,SUM(transaction_type="Return") returns,SUM(transaction_type="Disposal") disposals FROM transactions')->fetch();
        respond(['success'=>true,'stats'=>array_map('intval',$row)]);
    }
    if ($method === 'GET') {
        $sql='SELECT t.*,i.item_name,i.item_code,u.name issuer_name,cu.name custodian_name FROM transactions t JOIN items i ON i.id=t.item_id JOIN users u ON u.id=t.issued_by LEFT JOIN custodians c ON c.id=t.custodian_id LEFT JOIN users cu ON cu.id=c.user_id WHERE 1=1';
        $values=[];if(!empty($_GET['type'])){$sql.=' AND t.transaction_type=?';$values[]=$_GET['type'];}$sql.=' ORDER BY t.transaction_date DESC';
        $stmt=db()->prepare($sql);$stmt->execute($values);$rows=array_map(function($r){$r['items']=['id'=>$r['item_id'],'item_name'=>$r['item_name'],'item_code'=>$r['item_code']];$r['custodians']=$r['custodian_id']?['id'=>$r['custodian_id'],'users'=>['name'=>$r['custodian_name']]]:null;$r['issuer']=['name'=>$r['issuer_name']];return $r;},$stmt->fetchAll());
        respond(['success'=>true,'data'=>$rows]);
    }
    if ($method !== 'POST') respond(['success'=>false,'message'=>'Transactions are immutable; create a correcting transaction instead'],405);
    require_roles(['Admin']);
    $body=request_body();$itemId=(int)($body['item_id']??0);$custodianId=!empty($body['custodian_id'])?(int)$body['custodian_id']:null;$type=$body['transaction_type']??'';
    if(!in_array($type,['Issuance','Transfer','Return','Disposal'],true)||$itemId<1) respond(['success'=>false,'message'=>'Valid item and transaction type are required'],422);
    db()->beginTransaction();
    $stmt=db()->prepare('SELECT * FROM items WHERE id=? FOR UPDATE');$stmt->execute([$itemId]);$item=$stmt->fetch();if(!$item){db()->rollBack();respond(['success'=>false,'message'=>'Item not found'],404);}
    $from=$item['custodian_id']?(int)$item['custodian_id']:null;
    if(in_array($item['status'],['Disposed','Lost'],true)&&$type!=='Return'){db()->rollBack();respond(['success'=>false,'message'=>'Disposed or lost items cannot be transacted'],422);}
    if(in_array($type,['Issuance','Transfer'],true)&&!$custodianId){db()->rollBack();respond(['success'=>false,'message'=>'A receiving custodian is required'],422);}
    if($type==='Issuance'&&$from){db()->rollBack();respond(['success'=>false,'message'=>'Item is already assigned; use Transfer'],422);}
    if(in_array($type,['Transfer','Return'],true)&&!$from){db()->rollBack();respond(['success'=>false,'message'=>'Item is not currently assigned'],422);}
    if($type==='Transfer'&&$from===$custodianId){db()->rollBack();respond(['success'=>false,'message'=>'Select a different receiving custodian'],422);}
    if($from){db()->prepare('UPDATE item_assignments SET return_date=NOW() WHERE item_id=? AND return_date IS NULL')->execute([$itemId]);}
    if(in_array($type,['Issuance','Transfer'],true)){
        db()->prepare('INSERT INTO item_assignments (item_id,custodian_id,condition_status,notes) VALUES (?,?,?,?)')->execute([$itemId,$custodianId,$item['condition_status'],$body['notes']??null]);
        $nameStmt=db()->prepare('SELECT u.name FROM custodians c JOIN users u ON u.id=c.user_id WHERE c.id=? AND c.status="Active"');$nameStmt->execute([$custodianId]);$name=$nameStmt->fetchColumn();if(!$name){db()->rollBack();respond(['success'=>false,'message'=>'Receiving custodian is not active'],422);}
        db()->prepare('UPDATE items SET custodian_id=?,assigned_to=?,status="Assigned" WHERE id=?')->execute([$custodianId,$name,$itemId]);
    } elseif($type==='Return') {
        db()->prepare('UPDATE items SET custodian_id=NULL,assigned_to=NULL,status="Returned" WHERE id=?')->execute([$itemId]);
    } else {
        db()->prepare('UPDATE items SET custodian_id=NULL,assigned_to=NULL,status="Disposed" WHERE id=?')->execute([$itemId]);
    }
    $recordCustodian=in_array($type,['Issuance','Transfer'],true)?$custodianId:$from;
    $stmt=db()->prepare('INSERT INTO transactions (item_id,custodian_id,from_custodian_id,transaction_type,issued_by,notes,par_id,ics_id) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([$itemId,$recordCustodian,$from,$type,$user['id'],$body['notes']??null,$body['par_id']??null,$body['ics_id']??null]);$transactionId=(int)db()->lastInsertId();
    audit((int)$user['id'],'create','transaction',$transactionId,['type'=>$type,'item_id'=>$itemId]);db()->commit();
    respond(['success'=>true,'data'=>['id'=>$transactionId]],201);
}

function handle_maintenance(string $method, array $segments): never
{
    $user=current_user();
    if($method==='GET'){$rows=db()->query('SELECT m.*,i.item_name,i.item_code,u.name created_by_name FROM maintenance_records m JOIN items i ON i.id=m.item_id JOIN users u ON u.id=m.created_by ORDER BY m.scheduled_date DESC')->fetchAll();respond(['success'=>true,'data'=>$rows]);}
    require_roles(['Admin','Custodian']);$body=request_body();
    if($method==='POST'){$stmt=db()->prepare('INSERT INTO maintenance_records (item_id,custodian_id,maintenance_type,scheduled_date,cost,notes,status,created_by) VALUES (?,?,?,?,?,?,?,?)');$stmt->execute([$body['item_id'],$body['custodian_id']??null,trim((string)$body['maintenance_type']),$body['scheduled_date'],$body['cost']??0,$body['notes']??null,$body['status']??'Pending',$user['id']]);$id=(int)db()->lastInsertId();audit((int)$user['id'],'create','maintenance',$id);respond(['success'=>true,'data'=>['id'=>$id]],201);}
    if($method==='PUT'){$id=id_segment($segments,1);$status=$body['status']??'Pending';db()->prepare('UPDATE maintenance_records SET status=?,completed_date=IF(?="Completed",CURDATE(),completed_date),notes=COALESCE(?,notes) WHERE id=?')->execute([$status,$status,$body['notes']??null,$id]);audit((int)$user['id'],'update','maintenance',$id,['status'=>$status]);respond(['success'=>true]);}
    respond(['success'=>false,'message'=>'Maintenance endpoint not found'],404);
}

function handle_verifications(string $method, array $segments): never
{
    $user=current_user();
    if($method==='GET'){$rows=db()->query('SELECT v.*,u.name verified_by_name,cu.name custodian_name FROM inventory_verifications v JOIN users u ON u.id=v.verified_by JOIN custodians c ON c.id=v.custodian_id JOIN users cu ON cu.id=c.user_id ORDER BY v.verification_date DESC')->fetchAll();respond(['success'=>true,'data'=>$rows]);}
    require_roles(['Admin','Auditor']);$body=request_body();$expected=(int)($body['total_items_expected']??0);$found=(int)($body['items_found']??0);$missing=max(0,$expected-$found);$status=$missing>0?'Needs Review':'Completed';
    $stmt=db()->prepare('INSERT INTO inventory_verifications (custodian_id,total_items_expected,items_found,items_missing,discrepancies,status,verified_by) VALUES (?,?,?,?,?,?,?)');$stmt->execute([$body['custodian_id'],$expected,$found,$missing,json_encode($body['discrepancies']??[]),$status,$user['id']]);$id=(int)db()->lastInsertId();db()->prepare('UPDATE custodians SET last_verification=NOW() WHERE id=?')->execute([$body['custodian_id']]);audit((int)$user['id'],'create','verification',$id);respond(['success'=>true,'data'=>['id'=>$id]],201);
}

function handle_preferences(string $method): never
{
    $user=current_user();
    if($method==='GET'){$stmt=db()->prepare('SELECT * FROM user_preferences WHERE user_id=?');$stmt->execute([$user['id']]);$row=$stmt->fetch();if(!$row){db()->prepare('INSERT INTO user_preferences (user_id) VALUES (?)')->execute([$user['id']]);$stmt->execute([$user['id']]);$row=$stmt->fetch();}respond(['success'=>true,'data'=>$row]);}
    if($method==='PUT'){$body=request_body();$fields=['email_notifications','system_notifications','activity_log','item_updates','transaction_alerts','weekly_reports'];$values=array_map(fn($f)=>!empty($body[$f])?1:0,$fields);$assign=implode(',',array_map(fn($f)=>"{$f}=?",$fields));$values[]=$user['id'];db()->prepare("UPDATE user_preferences SET {$assign} WHERE user_id=?")->execute($values);audit((int)$user['id'],'update','preferences',$user['id']);respond(['success'=>true]);}
    respond(['success'=>false,'message'=>'Preferences endpoint not found'],404);
}

function handle_profile(string $method): never
{
    $user=current_user();
    if($method==='GET'){
        $pref=db()->prepare('SELECT * FROM user_preferences WHERE user_id=?');$pref->execute([$user['id']]);$preferences=$pref->fetch()?:[];
        $logs=db()->prepare('SELECT action,entity_type,entity_id,details,ip_address,created_at FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 100');$logs->execute([$user['id']]);$activity=$logs->fetchAll();
        $loginHistory=array_values(array_filter($activity,fn($entry)=>$entry['action']==='login'));
        respond(['success'=>true,'data'=>[
            'profile'=>$user,
            'preferences'=>$preferences,
            'loginHistory'=>$loginHistory,
            'activityLog'=>$activity,
            'security'=>['last_login'=>$loginHistory[0]['created_at']??null,'active_sessions'=>1,'two_factor_enabled'=>false],
        ]]);
    }
    respond(['success'=>false,'message'=>'Profile endpoint not found'],404);
}

function handle_reports(string $method): never
{
    current_user();if($method!=='GET')respond(['success'=>false,'message'=>'Method not allowed'],405);
    $items=db()->query('SELECT COUNT(*) totalItems,COALESCE(SUM(total_cost),0) totalValue,SUM(status IN ("Active","Assigned")) activeCount,SUM(condition_status="Damaged") damageCount,SUM(custodian_id IS NULL AND status<>"Disposed") notDistributedCount,SUM(custodian_id IS NOT NULL AND status<>"Disposed") assignedCount FROM items')->fetch();
    $custodians=db()->query('SELECT COUNT(*) totalCustodians,SUM(status="Active") activeCustodians,SUM(status="Inactive") inactiveCustodians FROM custodians')->fetch();
    $transactions=db()->query('SELECT COUNT(*) totalTransactions,SUM(transaction_type="Issuance") issuances,SUM(transaction_type="Transfer") transfers,SUM(transaction_type="Return") returns,SUM(transaction_type="Disposal") disposals FROM transactions')->fetch();
    $maintenance=db()->query('SELECT COUNT(*) total,SUM(status="Pending") pending,SUM(status="Completed") completed FROM maintenance_records')->fetch();
    $categories=db()->query('SELECT category AS label,COUNT(*) AS value FROM items GROUP BY category ORDER BY value DESC,category ASC')->fetchAll();
    $statuses=db()->query('SELECT status AS label,COUNT(*) AS value FROM items GROUP BY status ORDER BY value DESC,status ASC')->fetchAll();
    $trend=db()->query('SELECT DATE_FORMAT(transaction_date,"%Y-%m") AS month,COUNT(*) AS total,SUM(transaction_type="Issuance") AS issuances,SUM(transaction_type="Transfer") AS transfers,SUM(transaction_type="Return") AS returns_count,SUM(transaction_type="Disposal") AS disposals FROM transactions WHERE transaction_date>=DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 5 MONTH),"%Y-%m-01") GROUP BY DATE_FORMAT(transaction_date,"%Y-%m") ORDER BY month ASC')->fetchAll();
    respond(['success'=>true,'data'=>['items'=>$items,'custodians'=>$custodians,'transactions'=>$transactions,'maintenance'=>$maintenance,'analytics'=>['categories'=>$categories,'statuses'=>$statuses,'transaction_trend'=>$trend],'generated_at'=>date(DATE_ATOM)]]);
}

function handle_documents(string $method): never
{
    $user=current_user();
    if($method==='GET'){
        $sql='SELECT d.*,u.name generated_by_name FROM generated_documents d JOIN users u ON u.id=d.generated_by';
        $values=[];
        if($user['role']==='Custodian'){$sql.=' WHERE d.generated_by=?';$values[]=$user['id'];}
        $sql.=' ORDER BY d.created_at DESC LIMIT 250';$stmt=db()->prepare($sql);$stmt->execute($values);respond(['success'=>true,'data'=>$stmt->fetchAll()]);
    }
    if($method==='POST'){
        $body=request_body();$stmt=db()->prepare('INSERT INTO generated_documents (template_name,worksheet_name,output_name,document_type,generated_by,metadata) VALUES (?,?,?,?,?,?)');
        $stmt->execute([trim((string)($body['template_name']??'')),$body['worksheet_name']??null,trim((string)($body['output_name']??'')),$body['document_type']??'xlsx',$user['id'],json_encode($body['metadata']??[])]);$id=(int)db()->lastInsertId();audit((int)$user['id'],'generate','document',$id,['template'=>$body['template_name']??null]);respond(['success'=>true,'data'=>['id'=>$id]],201);
    }
    respond(['success'=>false,'message'=>'Document endpoint not found'],404);
}

function handle_attachments(string $method, array $segments): never
{
    $user=current_user();
    $id=isset($segments[1])&&ctype_digit((string)$segments[1])?(int)$segments[1]:null;
    $action=$segments[2]??'';

    if($method==='GET'&&$id!==null&&$action==='content'){
        $stmt=db()->prepare('SELECT * FROM asset_attachments WHERE id=?');$stmt->execute([$id]);$file=$stmt->fetch();
        if(!$file)respond(['success'=>false,'message'=>'Attachment not found'],404);
        $path=__DIR__.'/storage/attachments/'.$file['stored_name'];
        if(!is_file($path))respond(['success'=>false,'message'=>'Stored file is missing'],404);
        header('Content-Type: '.$file['mime_type']);
        header('Content-Length: '.filesize($path));
        header('Content-Disposition: '.(str_starts_with($file['mime_type'],'image/')?'inline':'attachment').'; filename="'.rawurlencode($file['original_name']).'"');
        header('X-Content-Type-Options: nosniff');
        readfile($path);exit;
    }

    if($method==='GET'){
        $itemId=(int)($_GET['item_id']??0);if($itemId<1)respond(['success'=>false,'message'=>'Item ID is required'],422);
        $stmt=db()->prepare('SELECT a.id,a.item_id,a.original_name,a.mime_type,a.file_size,a.attachment_type,a.created_at,u.name uploaded_by_name FROM asset_attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.item_id=? ORDER BY a.created_at DESC');$stmt->execute([$itemId]);
        respond(['success'=>true,'data'=>$stmt->fetchAll()]);
    }

    if($method==='POST'){
        require_roles(['Admin','Custodian']);
        $itemId=(int)($_POST['item_id']??0);$upload=$_FILES['file']??null;
        if($itemId<1||!$upload||$upload['error']!==UPLOAD_ERR_OK)respond(['success'=>false,'message'=>'Item and file are required'],422);
        if((int)$upload['size']>10*1024*1024)respond(['success'=>false,'message'=>'Files must not exceed 10 MB'],422);
        $allowed=['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'];
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);
        if(!in_array($mime,$allowed,true))respond(['success'=>false,'message'=>'Unsupported file type'],422);
        $directory=__DIR__.'/storage/attachments';if(!is_dir($directory)&&!mkdir($directory,0750,true))respond(['success'=>false,'message'=>'Cannot create attachment storage'],500);
        $extension=pathinfo($upload['name'],PATHINFO_EXTENSION);$stored=bin2hex(random_bytes(24)).($extension?'.'.strtolower($extension):'');
        if(!move_uploaded_file($upload['tmp_name'],$directory.'/'.$stored))respond(['success'=>false,'message'=>'Failed to store uploaded file'],500);
        $type=str_starts_with($mime,'image/')?'Photo':'Document';$stmt=db()->prepare('INSERT INTO asset_attachments (item_id,original_name,stored_name,mime_type,file_size,attachment_type,uploaded_by) VALUES (?,?,?,?,?,?,?)');
        $stmt->execute([$itemId,basename((string)$upload['name']),$stored,$mime,$upload['size'],$type,$user['id']]);$newId=(int)db()->lastInsertId();audit((int)$user['id'],'upload','attachment',$newId,['item_id'=>$itemId,'name'=>$upload['name']]);respond(['success'=>true,'data'=>['id'=>$newId]],201);
    }

    if($method==='DELETE'&&$id!==null){
        require_roles(['Admin']);$stmt=db()->prepare('SELECT stored_name,item_id FROM asset_attachments WHERE id=?');$stmt->execute([$id]);$file=$stmt->fetch();if(!$file)respond(['success'=>false,'message'=>'Attachment not found'],404);
        db()->prepare('DELETE FROM asset_attachments WHERE id=?')->execute([$id]);$path=__DIR__.'/storage/attachments/'.$file['stored_name'];if(is_file($path))unlink($path);audit((int)$user['id'],'delete','attachment',$id,['item_id'=>$file['item_id']]);respond(['success'=>true]);
    }
    respond(['success'=>false,'message'=>'Attachment endpoint not found'],404);
}
