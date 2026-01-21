# Security Features Documentation

## Overview

This document describes the security features implemented in the Tweet Garot PM system, including Two-Factor Authentication (2FA), password management, and HR Admin controls.

## Table of Contents

1. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
2. [Password Management](#password-management)
3. [HR Admin Controls](#hr-admin-controls)
4. [Security Audit Logging](#security-audit-logging)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)

---

## Two-Factor Authentication (2FA)

### Overview

2FA adds an extra layer of security by requiring users to provide a time-based one-time password (TOTP) in addition to their regular password. This is implemented using authenticator apps like Google Authenticator, Authy, Microsoft Authenticator, etc.

### Features

- **Optional 2FA**: Users can choose to enable or disable 2FA
- **QR Code Setup**: Easy setup by scanning a QR code with an authenticator app
- **Manual Entry**: Alternative manual entry of the secret key
- **Backup Codes**: 8 single-use backup codes generated when 2FA is enabled
- **Backup Code Regeneration**: Users can regenerate backup codes at any time

### User Flow

#### Enabling 2FA

1. Navigate to Security Settings (`/security`)
2. Click "Enable 2FA"
3. Scan the QR code with your authenticator app
4. Enter the 6-digit verification code
5. Save the 8 backup codes in a secure location
6. 2FA is now enabled

#### Logging in with 2FA

1. Enter email and password on login page
2. If 2FA is enabled, you'll be prompted for a verification code
3. Enter the 6-digit code from your authenticator app (or a backup code)
4. Access granted

#### Disabling 2FA

1. Navigate to Security Settings
2. Click "Disable 2FA"
3. Enter your password to confirm
4. 2FA is now disabled

---

## Password Management

### User Self-Service

Users can change their own passwords at any time:

1. Navigate to Security Settings (`/security`)
2. Click "Change Password"
3. Enter current password
4. Enter new password (minimum 8 characters)
5. Confirm new password
6. Password is changed

### Password Requirements

- Minimum 8 characters
- Must be different from current password
- No maximum length

### Force Password Change

When a user's password is reset by an HR Admin or they're using a default password, they will be required to change their password on next login. This is enforced by:

1. A modal that appears on app load (cannot be dismissed)
2. The `force_password_change` flag in the database
3. The flag is cleared when the user successfully changes their password

---

## HR Admin Controls

### Access Levels

There are three HR access levels:

- **None**: No HR admin capabilities
- **Read**: Can view user information and security logs
- **Write**: Can reset passwords, disable 2FA, and force password changes

By default:
- **Admins**: Write access
- **Managers**: Read access
- **Users**: No access

### HR Admin Features

#### Reset User Password

**Who can do this**: Users with HR Write access

**How it works**:
1. Navigate to User Management (`/users`)
2. Find the user you want to reset
3. Click "Reset Pwd" button
4. Confirm the action
5. A temporary password is generated and displayed
6. User is flagged to change password on next login
7. Share the temporary password securely with the user

**Security Notes**:
- Temporary passwords are randomly generated (16 characters)
- The action is logged in the security audit log
- Users MUST change the temporary password on next login

#### Disable 2FA for User

**Who can do this**: Users with HR Write access

**How it works**:
1. Navigate to User Management
2. Find a user with 2FA enabled (green "Enabled" badge)
3. Click "Disable 2FA" button
4. Confirm the action
5. The user's 2FA is immediately disabled

**Use cases**:
- User lost access to their authenticator app
- User lost their backup codes
- Emergency account access needed

#### Force Password Change

**Who can do this**: Users with HR Write access

**How it works**:
1. Navigate to User Management
2. Click "Force Pwd Change" button
3. Confirm the action
4. User will be required to change password on next login

**Use cases**:
- Suspected account compromise
- User shared their password
- Password policy compliance

---

## Security Audit Logging

### Overview

All security-related actions are logged for audit purposes. Logs include:

- Password changes (self-service)
- Password resets (by HR admin)
- 2FA enabled/disabled
- 2FA usage during login
- Backup code usage
- IP address and user agent

### Viewing Security Logs

Users can view their own security activity log:
1. Navigate to Security Settings
2. Scroll to "Security Activity" section
3. View the last 10 security events

HR Admins can view any user's security log via the API:
```
GET /api/security/audit-log/:userId
```

### Log Entry Fields

- **Action**: Type of security event
- **Timestamp**: When it occurred
- **IP Address**: Where it occurred from
- **User Agent**: Browser/device information
- **Performed By**: Who initiated the action (null for self-actions)
- **Metadata**: Additional context (e.g., "disabled_by_admin": true)

---

## API Endpoints

### Authentication

```
POST /api/auth/login
Body: { email, password }
Response: { user, token } OR { requires2FA: true, userId, email }

POST /api/auth/login/2fa
Body: { userId, token }
Response: { user, token }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user }
```

### 2FA Management

```
POST /api/security/2fa/setup
Headers: Authorization: Bearer <token>
Response: { secret, qrCode, manualEntry }

POST /api/security/2fa/enable
Headers: Authorization: Bearer <token>
Body: { token, secret }
Response: { message, backupCodes }

POST /api/security/2fa/disable
Headers: Authorization: Bearer <token>
Body: { password }
Response: { message }

GET /api/security/2fa/status
Headers: Authorization: Bearer <token>
Response: { enabled, backupCodesRemaining }

POST /api/security/2fa/regenerate-backup-codes
Headers: Authorization: Bearer <token>
Response: { message, backupCodes }
```

### Password Management

```
POST /api/security/password/change
Headers: Authorization: Bearer <token>
Body: { currentPassword, newPassword }
Response: { message }

POST /api/security/password/reset/:userId (HR Admin only)
Headers: Authorization: Bearer <token>
Body: { forceChange: true }
Response: { message, temporaryPassword, email, forceChange }

POST /api/security/password/force-change/:userId (HR Admin only)
Headers: Authorization: Bearer <token>
Response: { message }
```

### 2FA Admin Controls

```
POST /api/security/2fa/disable/:userId (HR Admin only)
Headers: Authorization: Bearer <token>
Response: { message }
```

### Security Audit Log

```
GET /api/security/audit-log/:userId?
Headers: Authorization: Bearer <token>
Response: [ { id, user_id, action, performed_by, ip_address, user_agent, metadata, created_at } ]
```

---

## Database Schema

### Users Table Additions

```sql
ALTER TABLE users
  ADD COLUMN two_factor_secret VARCHAR(255),
  ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN two_factor_backup_codes TEXT[],
  ADD COLUMN force_password_change BOOLEAN DEFAULT FALSE,
  ADD COLUMN password_changed_at TIMESTAMP,
  ADD COLUMN last_login_at TIMESTAMP;
```

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Security Audit Log Table

```sql
CREATE TABLE security_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  performed_by INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Frontend Components

### Pages

- **SecuritySettings** (`/security`): User-facing security management page
  - Password change
  - 2FA setup/management
  - Security activity log

- **UserManagement** (`/users`): HR Admin user management (enhanced)
  - User list with 2FA status
  - Password reset controls
  - 2FA disable controls
  - Force password change

### Components

- **ChangePasswordModal**: Modal for changing passwords
  - Supports forced password changes (cannot be dismissed)
  - Password strength validation
  - Current password verification

- **TwoFactorSetup**: 2FA management component
  - QR code display
  - Verification code entry
  - Backup codes display/download
  - Enable/disable 2FA

### Services

- **security.ts**: API client for all security endpoints
  - 2FA operations
  - Password management
  - HR Admin controls
  - Audit log retrieval

---

## Security Best Practices

### For End Users

1. **Enable 2FA**: Significantly reduces the risk of account compromise
2. **Use Strong Passwords**: Minimum 8 characters, but longer is better
3. **Store Backup Codes Safely**: Keep them in a password manager or secure location
4. **Change Passwords Regularly**: Especially if you suspect compromise
5. **Don't Share Passwords**: Each user should have their own account

### For HR Admins

1. **Verify Identity**: Always verify user identity before resetting passwords
2. **Secure Communication**: Share temporary passwords through secure channels
3. **Monitor Audit Logs**: Review security activity regularly
4. **Principle of Least Privilege**: Only grant HR access to users who need it
5. **Document Actions**: Keep records of password resets and account modifications

### For System Administrators

1. **Set JWT_SECRET**: Use a strong, random secret in production
2. **Enable HTTPS**: All authentication traffic should be encrypted
3. **Monitor Failed Logins**: Set up alerting for suspicious activity
4. **Regular Backups**: Include security audit logs in backups
5. **Keep Dependencies Updated**: Regularly update security packages

---

## Troubleshooting

### User Lost Authenticator App

**Solution**: HR Admin can disable 2FA for the user
1. User contacts HR Admin
2. HR Admin verifies user identity
3. HR Admin disables 2FA in User Management
4. User can log in with just password
5. User can re-enable 2FA with new device

### User Lost Backup Codes

**Options**:
1. If 2FA is still enabled and accessible: Regenerate backup codes in Security Settings
2. If locked out: HR Admin disables 2FA, user logs in and re-enables 2FA

### Forgot Password

**Solution**: HR Admin resets password
1. User contacts HR Admin
2. HR Admin verifies user identity
3. HR Admin resets password in User Management
4. HR Admin securely shares temporary password
5. User logs in and is forced to change password

### 2FA Codes Not Working

**Possible causes**:
1. **Time Sync Issue**: Ensure device time is accurate
2. **Wrong Secret**: Re-scan QR code or enter manual key
3. **Already Used Code**: Wait 30 seconds for new code
4. **Backup Code**: If out of options, use a backup code

### Force Password Change Won't Dismiss

**This is by design**: Users with `force_password_change` flag cannot dismiss the modal
**Solution**: Change your password as requested

---

## Migration Guide

### Running the Migration

```bash
cd backend
npm run migrate
```

This will run migration `022_add_2fa_and_password_management.sql` which:
- Adds 2FA and password management columns to users table
- Creates password_reset_tokens table
- Creates security_audit_log table
- Sets force_password_change=TRUE for all existing users

### Post-Migration Steps

1. **All existing users will be required to change their password on next login**
2. Inform users about the new security features
3. Encourage users to enable 2FA
4. Train HR Admins on password reset procedures

---

## Future Enhancements

Potential improvements to consider:

1. **Email Notifications**: Send emails when passwords are reset or 2FA is disabled
2. **Password History**: Prevent reuse of recent passwords
3. **Password Complexity Rules**: Require uppercase, lowercase, numbers, symbols
4. **Session Management**: View and revoke active sessions
5. **Login Notifications**: Alert users when their account is accessed
6. **Account Lockout**: Lock accounts after repeated failed login attempts
7. **WebAuthn/FIDO2**: Support for hardware security keys
8. **SMS 2FA**: Alternative 2FA delivery method (though TOTP is more secure)

---

## Support

For questions or issues with security features, contact your system administrator or reference this documentation.

For security vulnerabilities, please report them responsibly to your security team.
