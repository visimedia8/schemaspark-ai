# 🔐 SchemaSpark Security Setup Guide

## Overview

This guide will help you set up SchemaSpark as a **secure, personal application** with proper authentication, authorization, and protection against unwanted users.

## 🚀 Quick Start

### 1. First-Time Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Run the admin setup script
node scripts/setup-admin.js
```

This will:
- ✅ Create your first admin account
- ✅ Set up proper security measures
- ✅ Configure role-based access control

### 2. Configure Environment Security

Update your `backend/.env` file:

```env
# Change these for security
JWT_SECRET=your-super-secure-random-jwt-key-here
JWT_REFRESH_SECRET=your-super-secure-random-refresh-key-here
ADMIN_REGISTRATION_TOKEN=your-unique-admin-token-change-this

# Optional: IP restrictions
ALLOWED_IPS=192.168.1.100,192.168.1.101
```

### 3. Start Your Application

```bash
# Backend
cd backend && npm run dev

# Frontend (in another terminal)
cd frontend && npm run dev
```

## 🔑 Security Features Implemented

### ✅ User Authentication & Authorization

| Feature | Status | Description |
|---------|--------|-------------|
| **JWT Authentication** | ✅ | Secure token-based authentication |
| **Role-Based Access** | ✅ | Admin/User roles with different permissions |
| **Account Lockout** | ✅ | 5 failed attempts = 2-hour lockout |
| **Password Security** | ✅ | bcrypt hashing with 12 salt rounds |
| **Session Management** | ✅ | Automatic login attempt tracking |

### ✅ Registration Security

| Feature | Status | Description |
|---------|--------|-------------|
| **Admin-Only Registration** | ✅ | Only admins can create new accounts |
| **Rate Limiting** | ✅ | 3 registration attempts per 15 minutes |
| **Email Validation** | ✅ | Proper email format validation |
| **First User Auto-Admin** | ✅ | First registered user becomes admin |

### ✅ API Security

| Feature | Status | Description |
|---------|--------|-------------|
| **Request Validation** | ✅ | Input sanitization and validation |
| **CORS Protection** | ✅ | Configurable origin restrictions |
| **Helmet Security** | ✅ | Security headers (XSS, CSRF, etc.) |
| **IP Whitelisting** | ✅ | Optional IP-based access control |

## 👤 User Roles & Permissions

### Admin User (`role: 'admin'`)
- ✅ Create/manage other users
- ✅ Access all API endpoints
- ✅ View system logs and analytics
- ✅ Configure application settings
- ✅ Full access to all features

### Regular User (`role: 'user'`)
- ✅ Use AI schema generation
- ✅ Manage personal projects
- ✅ Access autosave features
- ✅ View own data only

## 🛡️ Security Configuration

### Environment Variables

```env
# Required - Change these!
JWT_SECRET=your-256-bit-random-secret-here
JWT_REFRESH_SECRET=your-256-bit-random-refresh-secret-here
ADMIN_REGISTRATION_TOKEN=your-unique-admin-registration-token

# Optional Security
ALLOWED_IPS=192.168.1.100,10.0.0.1  # Comma-separated IPs
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

### Generating Secure Secrets

#### For JWT Secrets (Linux/Mac):
```bash
# Generate 256-bit secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### For JWT Secrets (Windows PowerShell):
```powershell
# Generate random bytes and encode as base64
[System.Web.Security.Membership]::GeneratePassword(32, 0) | Out-Null
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))
```

## 📋 Step-by-Step Setup

### Step 1: Create Admin Account

```bash
cd backend
node scripts/setup-admin.js
```

**Example Output:**
```
🚀 SchemaSpark Admin Setup
==========================

Enter admin email: admin@yoursite.com
Enter admin password (min 8 characters): ********
Confirm password: ********

🔐 Hashing password...
👤 Creating admin account...

✅ Admin account created successfully!
==============================
📧 Email: admin@yoursite.com
🔑 Role: admin
📅 Created: 2025-09-15T05:25:45.123Z

🔐 Security Recommendations:
• Change the ADMIN_REGISTRATION_TOKEN in your .env file
• Use a strong, unique password
• Enable 2FA if available
• Regularly update your password

🎉 You can now log in to your SchemaSpark application!
```

### Step 2: Secure Environment Variables

1. **Generate new JWT secrets:**
   ```bash
   # Linux/Mac
   openssl rand -base64 32

   # Windows
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Update `.env` file:**
   ```env
   JWT_SECRET=NEW_SECURE_SECRET_HERE
   JWT_REFRESH_SECRET=NEW_SECURE_REFRESH_SECRET_HERE
   ADMIN_REGISTRATION_TOKEN=your-unique-admin-token-2025
   ```

### Step 3: Optional IP Restrictions

If you want to restrict access to specific IPs:

```env
# Allow only your home/office IPs
ALLOWED_IPS=192.168.1.100,192.168.1.101,10.0.0.50
```

### Step 4: Test Security Features

#### Test Account Lockout:
```bash
# Try logging in with wrong password 5 times
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yoursite.com","password":"wrongpassword"}'

# After 5 attempts, account will be locked for 2 hours
```

#### Test Admin Registration:
```bash
# Try to register without admin token (should fail)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Register with admin token (should succeed)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token-here" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## 🔧 Advanced Security Options

### IP Whitelisting

Add to your `backend/.env`:
```env
ALLOWED_IPS=192.168.1.100,192.168.1.101
```

### Custom CORS Policy

```env
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

### Rate Limiting Configuration

```env
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window
```

## 🚨 Security Best Practices

### 🔴 Critical Actions
- [ ] **Change default JWT secrets** immediately
- [ ] **Change admin registration token** after setup
- [ ] **Use strong, unique passwords**
- [ ] **Enable HTTPS in production**
- [ ] **Regularly update dependencies**

### 🟡 Recommended Actions
- [ ] **Set up IP whitelisting** for sensitive environments
- [ ] **Enable request logging** for monitoring
- [ ] **Configure firewall rules**
- [ ] **Set up automated backups**
- [ ] **Monitor login attempts**

### 🟢 Optional Enhancements
- [ ] **Add 2FA authentication**
- [ ] **Implement session timeouts**
- [ ] **Add password complexity requirements**
- [ ] **Set up audit logging**
- [ ] **Configure SSL/TLS certificates**

## 🔍 Monitoring & Logs

### View Security Logs

```bash
# Check application logs
tail -f backend/logs/app.log

# Look for security events
grep "security\|auth\|login\|failed" backend/logs/app.log
```

### Common Log Entries

```
2025-09-15 [info]: User logged in successfully { userId: "...", email: "admin@yoursite.com", role: "admin" }
2025-09-15 [warn]: Account lockout triggered for email: user@example.com
2025-09-15 [error]: Failed login attempt from IP: 192.168.1.100
```

## 🆘 Troubleshooting

### "Admin account already exists"
```bash
# If you need to reset, connect to MongoDB and delete admin user
mongosh schemaspark
db.users.deleteOne({ role: "admin" })
```

### "Invalid admin registration token"
- Check your `ADMIN_REGISTRATION_TOKEN` in `.env`
- Make sure the token is sent in the request header

### "Account is locked"
```bash
# Reset login attempts (requires admin access)
# Or wait 2 hours for automatic unlock
```

### "CORS error"
- Check `CORS_ORIGIN` in your `.env` file
- Make sure it matches your frontend URL

## 📞 Support

If you encounter issues:

1. **Check the logs**: `tail -f backend/logs/app.log`
2. **Verify environment variables**: `cat backend/.env`
3. **Test basic connectivity**: `curl http://localhost:3001/health`
4. **Check MongoDB connection**: Ensure MongoDB is running

## 🎯 Summary

Your SchemaSpark application is now **secure and personal** with:

- ✅ **Admin-only registration** - Only you can create accounts
- ✅ **Account lockout protection** - Brute force prevention
- ✅ **JWT authentication** - Secure session management
- ✅ **Role-based access** - Admin vs user permissions
- ✅ **IP whitelisting** - Optional network restrictions
- ✅ **Rate limiting** - DDoS protection
- ✅ **Security headers** - XSS/CSRF protection

**Your application is now ready for personal, secure use!** 🔐