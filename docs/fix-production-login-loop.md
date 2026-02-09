# Fix: Production Login Loop Issue

## Date
2026-02-08

## Problem Description

The application experienced a login loop issue that only occurred in production mode (`npm run build` && `npm start`) when testing on localhost. The login would complete successfully (showing success animation and confetti) and write an auth token to the database, but no cookies were being set in the browser, causing the user to be redirected back to the login page.

In development mode (`npm run dev`), the login worked correctly without any issues.

## Root Cause

The issue was caused by two problems:

### Primary Issue: `secure` Cookie Flag on HTTP Localhost
In production mode, `secure: process.env.NODE_ENV === 'production'` was setting the `secure` flag to `true`. Cookies with the `secure` flag can **only be transmitted over HTTPS connections**. When testing the production build on `http://localhost:3000`, browsers refuse to set these cookies, causing authentication to fail silently.

### Secondary Issue: `sameSite: 'strict'` Cookie Attribute
The `sameSite: 'strict'` setting was also problematic. 

When cookies are set with `sameSite: 'strict'`:
- Browsers won't send these cookies on any cross-site requests
- More importantly, browsers won't send these cookies on **top-level navigation requests**, even to the same origin
- This includes redirects after form submissions

In Next.js production mode, the optimized build handles redirects and navigation differently than in development mode. When the login API sets cookies with `sameSite: 'strict'` and then redirects the user to `/dashboard`, the browser doesn't include the authentication cookies in the subsequent request, causing the app to think the user is not authenticated.

## Solution

Made three key changes to all authentication routes:

1. **Fixed `secure` flag by checking connection protocol**: Changed from hostname-based detection to protocol-based detection. Now checks if the connection is HTTPS (via `x-forwarded-proto` header or request URL) instead of checking domain names
2. **Changed `sameSite` from `'strict'` to `'lax'`**: Allows cookies to be sent on same-site navigation
3. **Added explicit `path: '/'`**: Ensures cookies are available across the entire application

### How It Works

The code now checks the actual connection protocol instead of the hostname:

```typescript
const protocol = request.headers.get("x-forwarded-proto") ||
                (request.url.startsWith("https") ? "https" : "http");
const isHttps = protocol === "https";
const useSecure = process.env.NODE_ENV === "production" && isHttps;
```

This works for **any domain**:
- ✅ `http://localhost:3000` - cookies work
- ✅ `http://internal.domain` - cookies work
- ✅ `http://192.168.1.100` - cookies work
- ✅ `http://intranet.company.com` - cookies work
- ✅ `https://production.com` - secure cookies enforced

### Security Considerations

`sameSite: 'lax'` still provides strong CSRF protection:
- ✅ Cookies are sent on safe top-level navigation (GET requests)
- ✅ Cookies are blocked on cross-site POST/PUT/DELETE requests
- ✅ Cookies are blocked in third-party contexts (iframes, fetch from other sites)
- ✅ Combined with `httpOnly: true` and `secure: true` (in production), provides robust security

This is the appropriate setting for authentication cookies in web applications.

## Files Modified

### 1. `app/api/auth/login/route.ts`
**Before:**
```typescript
nextResponse.cookies.set('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60, // 15 minutes
})
```

**After:**
```typescript
// Check actual connection protocol instead of hostname
const protocol = request.headers.get("x-forwarded-proto") ||
                (request.url.startsWith("https") ? "https" : "http");
const isHttps = protocol === "https";
const useSecure = process.env.NODE_ENV === "production" && isHttps;

nextResponse.cookies.set('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: useSecure,  // Only true if actually using HTTPS
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/'
})
```

### 2. `app/api/auth/login/second-factor/route.ts`
Applied the same protocol-based cookie security check for two-factor authentication flow.

### 3. `app/api/auth/passkeys/authenticate/verify/route.ts`
Applied the same protocol-based cookie security check for passkey authentication flow.

### 4. `app/api/auth/refresh/route.ts`
Applied the same protocol-based cookie security check for token refresh flow.

### 5. `app/api/auth/oauth/callback/[providerName]/route.ts`
Applied the same protocol-based cookie security check for OAuth callback flow.

## Testing

After applying these changes:

1. Rebuild the application:
   ```bash
   npm run build
   ```

2. Start in production mode:
   ```bash
   npm start
   ```

3. Test the login flow:
   - Navigate to `/login`
   - Enter valid credentials
   - Verify successful redirect to `/dashboard`
   - Verify that subsequent page navigation maintains authentication
   - Check that the cookies are properly set in browser DevTools

## Related Information

- **Cookie `sameSite` attribute documentation**: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- **Next.js production vs development differences**: Next.js applies optimizations in production that can affect how redirects and cookies are handled
- **Browser behavior**: Modern browsers enforce strict cookie policies, especially in production HTTPS environments

## Key Takeaways

1. **Cookies with `secure: true` require HTTPS**: Never set `secure: true` blindly in production mode without considering localhost testing
2. **Test production builds on localhost**: Always test production builds locally before deploying to catch these issues
3. **Use `sameSite: 'lax'`** for authentication cookies that need to work with redirects
4. **Check browser DevTools**: If login seems to work but cookies aren't being set, check the Network tab for Set-Cookie headers and Application tab for cookie storage

## Prevention

Going forward, when setting authentication cookies:
- **Check the connection protocol, not the hostname** - use `x-forwarded-proto` header or request URL to determine HTTPS
- Use `sameSite: 'lax'` for authentication cookies that need to work with redirects
- Use `sameSite: 'strict'` only for cookies that should never be sent on any cross-site request (rare cases)
- Always test authentication flows in production mode on various domains before deploying
- Ensure consistency across all authentication routes (login, OAuth, passkeys, 2FA, refresh)
- Remember that `secure: true` requires HTTPS - it's protocol-based, not environment-based
