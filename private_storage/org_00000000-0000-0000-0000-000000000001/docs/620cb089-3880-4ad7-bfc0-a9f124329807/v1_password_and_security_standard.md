# Corporate Password, MFA & Security Standard

## 1. Password Complexity Rules
All company user accounts must adhere to the following baseline complexity requirements:
- Minimum length: 14 characters.
- Must contain uppercase letters, lowercase letters, numbers, and special symbols.
- Passwords must not contain common dictionary words, employee names, or sequential characters (e.g., "Company123!").
- Passwords expire every 90 days for privileged administrative accounts.

## 2. Multi-Factor Authentication (MFA) Requirements
MFA is mandatory across all internal SaaS tools, VPNs, single sign-on (SSO) gateways, and code repositories.
- Approved MFA methods: FIDO2 / WebAuthn hardware security keys (YubiKey) or TOTP authenticator apps (1Password, Google Authenticator).
- SMS and voice call verification are explicitly prohibited due to SIM-swapping vulnerabilities.

## 3. Session Timeouts and Device Locking
- Workstations must automatically lock after 5 minutes of inactivity.
- Web session cookies for internal portals expire after 12 hours of inactivity.
