# Bluelight Hub Authentication Implementation Analysis

## Executive Summary

Bluelight Hub implements a **hybrid passwordless + password authentication system** with role-based access control. Normal users log in with username only (passwordless), while Admins have an optional password that must be explicitly set during setup.

---

## 1. AUTHENTICATION FLOW

### 1.1 Unified Authentication Endpoint: `POST /auth/unified`

**Purpose:** Single entry point for both login and auto-registration

**Request:**
```typescript
{
  username: string     // 3-30 chars, alphanumeric + underscore/hyphen
  password?: string    // Optional - only used for admin credentials
}
```

**Response:**
```typescript
{
  isNewUser: boolean,  // true if auto-registered
  user: {
    id: string,
    username: string,
    role: "USER" | "ADMIN" | "SUPER_ADMIN",
    isActive: boolean,
    createdAt: ISO8601
  },
  // Tokens sent as HTTP-Only cookies (not in JSON body)
  // Cookies: accessToken, refreshToken
}
```

**Authentication Logic:**

```
IF user exists:
  IF user is deleted or locked:
    THROW "Account locked/deleted"
  ELSE:
    LOGIN (no password check for regular users)
    
ELSE (user doesn't exist):
  AUTO-REGISTER with role selection:
    IF no admin exists yet:
      role = SUPER_ADMIN (first user gets admin)
    ELSE:
      role = USER
```

**Key Insight:** Passwords are NOT checked during normal login. The password field is ignored for existing users.

---

## 2. PASSWORDLESS AUTHENTICATION

### 2.1 How It Works

Normal users (USER role) log in with **username only**:
- No password stored in database
- `passwordHash` field is NULL
- Immediate login on first auth attempt with username
- User can be auto-registered if they don't exist

### 2.2 First User Special Case

The **first user ever created** automatically becomes `SUPER_ADMIN`:

```typescript
// From auth.service.ts
const adminCount = await this.prisma.user.count({
  where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, ... }
});

const role = adminCount === 0 ? 'SUPER_ADMIN' : 'USER';
```

This enables bootstrap - no initial admin setup required.

---

## 3. ADMIN PASSWORD AUTHENTICATION

### 3.1 Admin Setup Flow

**Endpoint:** `POST /auth/admin/setup` (requires USER authentication)

**Request:**
```typescript
{
  password: string  // Min 8 chars
}
```

**Process:**
1. Currently authenticated USER (must have ADMIN or SUPER_ADMIN role) provides a password
2. Password is hashed with bcrypt (10 rounds)
3. Stored in `User.passwordHash`
4. Admin token generated and returned

**Conditions:**
- User must be authenticated with valid accessToken
- User must have ADMIN or SUPER_ADMIN role
- User must not already have a password set (throws 409 Conflict)

### 3.2 Admin Login with Password

**Endpoint:** `POST /auth/admin/login` (requires USER authentication)

**Request:**
```typescript
{
  password: string  // Must match stored passwordHash
}
```

**Process:**
1. Currently authenticated user provides their admin password
2. Password compared against stored hash with bcrypt
3. If valid, generates separate ADMIN_TOKEN
4. Both accessToken AND adminToken now required for admin operations

**Security Flow:**
```
NORMAL USER LOGIN (passwordless)
  ↓
USER gets accessToken + refreshToken
  ↓
USER provides password to /admin/login
  ↓
Server verifies password with bcrypt
  ↓
USER gets additional adminToken in separate cookie
```

---

## 4. TOKEN ARCHITECTURE

### 4.1 Three Types of Tokens

#### 1. **Access Token** (JWT)
- **Duration:** 15 minutes (configurable)
- **Cookie:** `accessToken` (HTTP-Only)
- **Payload:** `{ sub: userId, username, role }`
- **Used for:** Regular API authentication
- **Guard:** `JwtAuthGuard`

#### 2. **Refresh Token** (JWT)
- **Duration:** 7 days (configurable)
- **Cookie:** `refreshToken` (HTTP-Only)
- **Payload:** `{ sub: userId }`
- **Purpose:** Renew access tokens without re-login
- **Endpoint:** `POST /auth/refresh`

#### 3. **Admin Token** (JWT - separate secret)
- **Duration:** 15 minutes
- **Cookie:** `adminToken` (HTTP-Only)
- **Payload:** `{ sub: userId, username, role, isAdmin: true, permissions: [...] }`
- **Secret:** `ADMIN_JWT_SECRET` (different from regular JWT_SECRET)
- **Guard:** `AdminJwtAuthGuard`
- **Requirements:** Must have valid accessToken + adminToken simultaneously

**Key Insight:** Admin tokens are **completely separate** from regular tokens. A user needs BOTH accessToken AND adminToken to access admin endpoints.

### 4.2 Token Storage

All tokens stored as **HTTP-Only cookies** (never in JSON response):
- `httpOnly: true` - JavaScript cannot access
- `secure: true` (production only) - HTTPS only
- `sameSite: strict` - CSRF protection
- `path: /` - Available to entire app

---

## 5. AUTHENTICATION STATE

### 5.1 Authentication Check Endpoint

**Endpoint:** `GET /auth/check` (public)

**Response:**
```typescript
{
  authenticated: boolean,
  isAdminAuthenticated?: boolean,
  user?: {
    id, username, role, isActive, createdAt
  }
}
```

**Behavior:**
1. Check if accessToken exists
2. If missing, try to refresh using refreshToken
3. Check if adminToken is valid
4. Always returns 200 (never 401) to prevent race conditions on app load
5. Frontend must check `authenticated` field in response

**Auto-Refresh Logic:**
```
IF no accessToken but refreshToken exists:
  VERIFY refreshToken validity
  GENERATE new accessToken + refreshToken
  SET new cookies
  RETURN user + new tokens
```

---

## 6. ROLE-BASED ACCESS CONTROL

### 6.1 User Roles

**Three roles defined in Prisma:**
```prisma
enum UserRole {
  SUPER_ADMIN  // All permissions (*)
  ADMIN        // users:*, system:read
  USER         // No special permissions
}
```

### 6.2 Admin Permissions Matrix

```typescript
SUPER_ADMIN   → ['*']                    // Everything
ADMIN         → ['users:*', 'system:read']
MODERATOR     → ['users:read', 'users:update']
USER          → []                       // No permissions
```

### 6.3 Admin State Detection

**Can be Admin?** If user role is ADMIN or SUPER_ADMIN
**Is Admin authenticated?** If valid adminToken exists + accessToken valid

**Backend checks:**
```typescript
// Check if user has admin role
const isAdminRole = isAdmin(user.role); // true if ADMIN or SUPER_ADMIN

// Check if user has password (admin setup done)
const hasPassword = !!user.passwordHash;

// Both must be true to activate admin
```

---

## 7. SPECIAL CASES & EDGE CASES

### 7.1 User Account Lifecycle

**Active User:**
```
isActive: true
isDeleted: false
isLocked: false
```

**Deleted User:**
```
isDeleted: true
deletedAt: <timestamp>
deletedBy: <username>
// Can be re-activated by logging in (special recovery logic)
```

**Locked User:**
```
isLocked: true
isLockedManuallyAt: <timestamp>
isLockedManuallyBy: <username>
lockReason: string  // Admin-provided reason
// Throws UnauthorizedException with reason on login
```

### 7.2 First Admin Setup

**Scenario:** First user logs in, is auto-promoted to SUPER_ADMIN

**Steps:**
1. `POST /auth/unified` with username → AUTO-REGISTERED as SUPER_ADMIN
2. `GET /auth/admin/status` → tells frontend admin setup is available
3. `POST /auth/admin/setup` with password → Admin password stored
4. `POST /auth/admin/login` with password → Activate admin privileges

### 7.3 Admin Role Switching

**Can user switch between USER and ADMIN mode?**

Yes:
- User has BOTH roles (if assigned by admin)
- `POST /auth/admin/login` → Activates admin token → Admin mode ON
- `POST /auth/admin/logout` → Removes admin token → Admin mode OFF
- Regular token remains valid (user stays logged in)

**Key:** Admin logout is NOT full logout - it just drops the adminToken.

### 7.4 Race Condition Handling

**Multiple concurrent registration requests for same username:**

```typescript
// If race condition occurs (2 concurrent POST /auth/unified requests)
if (this.isUniqueConstraintError(error)) {
  // Unique constraint violation → User was created by other request
  const existingUser = await this.findUserByUsername(username);
  // Retry login with created user
  return this.loginExistingUser(existingUser);
}
```

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Password Hashing

- **Algorithm:** bcrypt with 10 rounds
- **Only applies to:** Admin accounts (optional)
- **When:** During `POST /auth/admin/setup`

```typescript
const passwordHash = await bcrypt.hash(dto.password, 10);
```

### 8.2 Cookie Security

| Setting | Development | Production |
|---------|------------|------------|
| httpOnly | true | true |
| secure | false | true |
| sameSite | strict | strict |
| path | / | / |

### 8.3 Token Verification

- **JWT Secret:** Validated on every request via Passport strategy
- **Admin Token Secret:** Separate secret (`ADMIN_JWT_SECRET`)
- **Refresh Token Secret:** Separate secret (`JWT_REFRESH_SECRET`)
- **Token validation:** Includes existence check in database

```typescript
// JWT validation includes DB check
async validate(payload: JwtPayload): Promise<ValidatedUser> {
  const user = await this.authService.findUserById(payload.sub);
  if (!user) throw new UnauthorizedException('User no longer exists');
  return { userId: payload.sub, role: payload.role };
}
```

### 8.4 Rate Limiting

- `POST /auth/unified`: 5 requests/minute (login/register)
- `GET /auth/check`: 10 requests/minute (token refresh)

---

## 9. ENDPOINTS SUMMARY

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---|---------|
| POST | `/auth/unified` | ❌ | Login / Auto-register |
| POST | `/auth/admin/setup` | ✅ User | Set admin password |
| POST | `/auth/admin/login` | ✅ User | Activate admin token |
| POST | `/auth/admin/logout` | ❌ | Deactivate admin token |
| POST | `/auth/refresh` | ✅ RefreshToken | Renew access token |
| POST | `/auth/logout` | ❌ | Clear all tokens |
| GET | `/auth/check` | ❌ | Check auth status |
| GET | `/auth/admin/status` | ✅ User | Check admin setup status |
| GET | `/auth/admin/verify` | ✅ AdminToken | Verify admin token |
| GET | `/auth/users` | ❌ | List all usernames (public) |

---

## 10. DATA FLOW EXAMPLES

### Example 1: First User Setup

```
1. User opens app, clicks "Login"
2. Frontend calls GET /auth/users → Gets empty list
3. User enters username "admin1" → POST /auth/unified
4. Backend: No user found → Auto-register with SUPER_ADMIN role
5. Response: { user: {...}, isNewUser: true }
6. Cookies set: accessToken, refreshToken
7. Frontend calls GET /auth/check → Confirms authenticated
8. Frontend offers admin setup button
9. User enters password → POST /auth/admin/setup
10. Backend: Hash password, store in DB, generate adminToken
11. Cookies now have: accessToken, refreshToken, adminToken
12. Admin functions enabled in UI
```

### Example 2: Normal User Login

```
1. User enters username "user1" → POST /auth/unified
2. Backend: User exists (created previously)
3. Response: { user: {...}, isNewUser: false }
4. Cookies set: accessToken, refreshToken
5. NO adminToken (user has no admin role)
6. Admin functions unavailable in UI
```

### Example 3: Existing Admin Re-Login

```
1. User enters username "admin1" → POST /auth/unified
2. Backend: User exists, has SUPER_ADMIN role
3. Password field ignored (no password check in unified endpoint!)
4. Response: { user: {...}, isNewUser: false }
5. Cookies set: accessToken, refreshToken
6. NO adminToken yet
7. Frontend detects user.role === SUPER_ADMIN
8. Frontend shows "Enter Admin Password" dialog
9. User enters password → POST /auth/admin/login
10. Backend: Verify password against hash
11. adminToken generated and set
12. Admin functions now enabled
```

---

## 11. KEY FINDINGS

### ✅ What Works

1. **Passwordless by default** - Normal users just need username
2. **Bootstrap friendly** - First user auto-promoted to admin
3. **Flexible admin activation** - Password can be set/updated anytime
4. **Secure token separation** - Admin token is completely separate
5. **Auto-refresh logic** - Sessions persist across page reloads
6. **Account lifecycle** - Soft delete + lock functionality
7. **Role-based control** - Three tiers of permissions

### ⚠️ Current Limitations

1. **No password check during unified login** - Admin password is ignored if set
   - Workaround: Use `/auth/admin/login` endpoint for admin accounts
   
2. **No role switching endpoint** - Must logout/login to change roles
   - Workaround: Admin can deactivate with `/auth/admin/logout`

3. **No password reset mechanism** - If admin forgets password, only admins can reset it

4. **No multi-factor authentication** - Only passwords available

5. **No permission guards** - No decorator-based permission checking implemented
   - Controllers must manually check `user.role`

---

## 12. IMPLEMENTATION CHECKLIST

For future developers:

- [ ] Frontend must check `authenticated` field on `/auth/check`
- [ ] Frontend must handle token refresh automatically
- [ ] Frontend must store token expiry times for UI state
- [ ] Admin endpoints need manual role checks currently
- [ ] Password complexity requirements needed in frontend
- [ ] Session timeout warnings needed
- [ ] Password reset flow missing
- [ ] Audit logging for admin actions recommended
- [ ] 2FA/MFA not implemented
- [ ] Permission decorators would improve security

