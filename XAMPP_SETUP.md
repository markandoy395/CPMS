# XAMPP Setup

1. Open XAMPP Control Panel and start **MySQL**.
2. Import `database/schema.sql` using phpMyAdmin.

   The schema uses the `cpms_react` database and does not alter an existing `cpms` database.
3. Create the first administrator with a private password of at least 12 characters:

   ```powershell
   $env:CPMS_ADMIN_EMAIL='your-admin-email'
   $env:CPMS_ADMIN_PASSWORD='your-private-password'
   C:\xampp\php\php.exe api\create_admin.php
   ```

4. Start the PHP API:

   ```powershell
   npm run api
   ```

5. In another terminal, start React:

   ```powershell
   npm run dev
   ```

Open `http://localhost:3000`. Public signup always creates a Custodian account; only an administrator can grant Admin or Auditor access.

For a non-default MariaDB password, set `CPMS_DB_PASSWORD` before running the administrator command or API.
