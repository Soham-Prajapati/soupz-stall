// pairing.js — OTP-based pairing, session validation, pairing API routes

import crypto from 'crypto';
import os from 'os';
import {
    app,
    ctx,
    supabase,
    pairingCodes,
    activeSessions,
    requireAuth,
    isLocalRequest,
    revokeSession,
    getLocalIPs,
    getTunnelBaseUrls,
    runtimeTunnelBaseUrls,
    SESSION_EXPIRY_MS,
} from './shared.js';

// QR code for terminal display (optional)
let QRCode = null;
try { QRCode = (await import('qrcode')).default; } catch { /* qrcode not installed */ }

export const PAIRING_CODE_LENGTH = 9;
export const PAIRING_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_REFRESH_THRESHOLD_MS = 23 * 60 * 60 * 1000; // 23 hours

// ─── Code generation ──────────────────────────────────────────────────────────

function generatePairingCode() {
    // Generate a human-readable 9-character alphanumeric code
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Avoid ambiguous 0, 1, O, I
    let code = '';
    const bytes = crypto.randomBytes(PAIRING_CODE_LENGTH);
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

let lastCodeCreateTime = 0;

function hasReusableDisplayCode(now = Date.now()) {
    if (!ctx.currentPairingCode) return false;
    const stillTracked = pairingCodes.has(ctx.currentPairingCode.code);
    const notExpired = now < (ctx.currentPairingCode.expiresAt || 0);
    return stillTracked && notExpired;
}

export function createPairingCode(force = false) {
    const now = Date.now();
    // Cooldown: don't create a new code more than once every 5 seconds unless current code was consumed/expired
    if (!force && (now - lastCodeCreateTime) < 5000 && hasReusableDisplayCode(now)) {
        return ctx.currentPairingCode;
    }
    lastCodeCreateTime = now;

    // Clean expired codes
    for (const [code, data] of pairingCodes) {
        if (now > data.expiresAt) pairingCodes.delete(code);
    }

    const code = generatePairingCode();
    const token = generateSessionToken();
    const expiresAt = now + PAIRING_CODE_EXPIRY_MS;

    pairingCodes.set(code, { token, createdAt: now, expiresAt });

    // Register in Supabase for remote pairing if available
    if (supabase) {
        const connectTargets = Array.from(new Set([...getLocalIPs(), ...getTunnelBaseUrls()]));
        // Cleanup expired codes in DB
        supabase.from('soupz_pairing').delete().lt('expires_at', new Date().toISOString()).then(() => {});

        // Register machine as online
        supabase.from('soupz_machines').upsert({
            id: os.hostname(),
            name: os.hostname(),
            last_seen: new Date().toISOString(),
            status: 'online'
        }).then(() => {});

        supabase
            .from('soupz_pairing')
            .upsert({
                code,
                token,
                hostname: os.hostname(),
                lan_ips: connectTargets,
                port: ctx.activePort,
                created_at: new Date(now).toISOString(),
                expires_at: new Date(expiresAt).toISOString(),
            })
            .then(({ error }) => {
                if (error) console.error(`[supabase] pairing register failed: ${error.message}`);
            });
    }

const formatted = `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}`;
return { code, formatted, expiresAt, expiresIn: Math.round(PAIRING_CODE_EXPIRY_MS / 1000) };
}

function normalizeRemoteBase(target, port) {
    if (!target) return null;
    const trimmed = target.toString().trim().replace(/\/$/, '');
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes('://')) return trimmed;
    if (trimmed.includes(':')) return `http://${trimmed}`;
    return `http://${trimmed}:${port}`;
}

function pickPreferredRemoteBase(connectTargets, port) {
    if (!Array.isArray(connectTargets) || connectTargets.length === 0) return null;
    const normalized = connectTargets
        .map((target) => normalizeRemoteBase(target, port))
        .filter(Boolean);
    if (!normalized.length) return null;
    const httpsTarget = normalized.find((url) => url.startsWith('https://'));
    return (httpsTarget || normalized[0]).replace(/\/$/, '');
}

function buildConnectUrl(pairingCode, remoteBaseUrl) {
    const base = ctx.webappBaseUrl.replace(/\/$/, '');
    const params = new URLSearchParams({ code: pairingCode });
    if (remoteBaseUrl) params.set('remote', remoteBaseUrl);
    return `${base}/code?${params.toString()}`;
}

/** Auto-refresh: generate a new code and display it, repeat every 5 minutes */
export function startCodeAutoRefresh() {
    if (ctx.codeRefreshTimer) return; // Already running

    ctx.currentPairingCode = createPairingCode();

    ctx.codeRefreshTimer = setInterval(() => {
        ctx.currentPairingCode = createPairingCode();
        if (!ctx.silentMode) {
            const snapshot = getCurrentPairingSnapshot();
            console.log(`\n  \x1b[38;5;214m🔑  New Code: ${snapshot?.formatted || ctx.currentPairingCode.formatted}\x1b[0m  \x1b[2m(auto-refreshed)\x1b[0m`);
            if (QRCode && snapshot?.connectUrl) {
                QRCode.toString(snapshot.connectUrl, { type: 'terminal', small: true, errorCorrectionLevel: 'L' })
                    .then(qr => console.log(`\n${qr}`))
                    .catch(() => {});
            }
        }
        if (ctx.codeRefreshCallback) ctx.codeRefreshCallback(getCurrentPairingSnapshot());
    }, PAIRING_CODE_EXPIRY_MS);
}

/** Get the current active pairing code (for display) */
export function getCurrentCode() {
    return ctx.currentPairingCode;
}

export function validatePairingCode(code) {
    const data = pairingCodes.get(code);
    if (!data) return null;
    if (Date.now() > data.expiresAt) {
        pairingCodes.delete(code);
        return null;
    }
    // Code is valid — create session, delete code (one-time use)
    const { token } = data;
    pairingCodes.delete(code);
    activeSessions.set(token, { createdAt: Date.now(), lastSeen: Date.now(), clientType: 'unknown' });

    // If the consumed code is currently displayed, rotate immediately so /pair/current and QR stay valid.
    if (ctx.currentPairingCode?.code === code) {
        ctx.currentPairingCode = createPairingCode();
        if (ctx.codeRefreshCallback) ctx.codeRefreshCallback(getCurrentPairingSnapshot());
    }

    return token;
}

function refreshSessionToken(currentToken, { force = false } = {}) {
    if (!currentToken) return { ok: false, status: 400, error: 'Missing active session token' };
    const session = activeSessions.get(currentToken);
    if (!session) return { ok: false, status: 401, error: 'Invalid session token' };

    const now = Date.now();
    const ageMs = Math.max(0, now - Number(session.createdAt || now));
    if (!force && ageMs < SESSION_REFRESH_THRESHOLD_MS) {
        return {
            ok: true,
            token: currentToken,
            refreshed: false,
            createdAt: session.createdAt,
            expiresIn: Math.max(0, Math.round((SESSION_EXPIRY_MS - ageMs) / 1000)),
        };
    }

    const nextToken = generateSessionToken();
    activeSessions.set(nextToken, {
        ...session,
        createdAt: now,
        lastSeen: now,
        refreshedFrom: currentToken,
    });
    activeSessions.delete(currentToken);

    return {
        ok: true,
        token: nextToken,
        refreshed: true,
        createdAt: now,
        expiresIn: Math.round(SESSION_EXPIRY_MS / 1000),
    };
}

export function getCurrentPairingSnapshot() {
    const pairing = getCurrentCode();
    if (!pairing) return null;
    const localIPs = getLocalIPs();
    const tunnelUrls = getTunnelBaseUrls();
    const connectTargets = Array.from(new Set([...localIPs, ...tunnelUrls]));
    const remoteBaseUrl = pickPreferredRemoteBase(connectTargets, ctx.activePort);
    const connectUrl = buildConnectUrl(pairing.code, remoteBaseUrl);
    const expiresIn = Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000));

    return {
        code: pairing.code,
        formatted: pairing.formatted,
        expiresIn,
        connectUrl,
        remoteBaseUrl,
        connectTargets,
        lanIps: localIPs,
        tunnelUrls,
        qrData: JSON.stringify({
            type: 'soupz-pair',
            host: localIPs[0] || 'localhost',
            port: ctx.activePort,
            code: pairing.code,
        }),
    };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// PUBLIC: Generate a pairing code (called from laptop CLI)
app.post('/pair', (req, res) => {
    ctx.currentPairingCode = createPairingCode();
    const snapshot = getCurrentPairingSnapshot();
    if (ctx.codeRefreshCallback) ctx.codeRefreshCallback(snapshot);

    if (!ctx.silentMode) {
        console.log(`\n  🔑 Pairing code generated: ${snapshot?.formatted || snapshot?.code || 'N/A'}`);
        console.log(`     Expires in ${snapshot?.expiresIn ?? 0}s`);
        // Print QR code in terminal if available
        if (QRCode && snapshot?.connectUrl) {
            QRCode.toString(snapshot.connectUrl, { type: 'terminal', small: true, errorCorrectionLevel: 'L' })
                .then(qr => { if (!ctx.silentMode) console.log(`\n${qr}`); })
                .catch(() => {});
        }
    }

    if (!snapshot) return res.status(500).json({ error: 'Failed to generate pairing code' });

    res.json({
        code: snapshot.code,
        expiresIn: snapshot.expiresIn,
        qrData: snapshot.qrData,
        connectUrls: snapshot.connectTargets,
        connectUrl: snapshot.connectUrl,
    });
});

// PUBLIC: Get the currently active pairing code snapshot (for diagnostics / QR location)
app.get('/pair/current', (req, res) => {
    const snapshot = getCurrentPairingSnapshot();
    if (!snapshot) {
        return res.status(404).json({ error: 'No active pairing code' });
    }
    res.json(snapshot);
});

// LOCAL ONLY: Register runtime tunnel targets without restarting daemon
app.post('/api/system/tunnel-targets', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Tunnel target registration is local-only' });
    }

    const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
    const normalized = rawUrls
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
        .map((value) => value.replace(/\/$/, ''));

    runtimeTunnelBaseUrls.clear();
    for (const url of normalized) runtimeTunnelBaseUrls.add(url);

    res.json({ success: true, tunnelUrls: Array.from(runtimeTunnelBaseUrls) });
});

app.get('/api/system/tunnel-targets', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Tunnel target query is local-only' });
    }
    res.json({ tunnelUrls: getTunnelBaseUrls() });
});

// LOCAL ONLY: Update pairing runtime config (web app URL + tunnel URLs)
app.post('/api/system/pairing-config', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Pairing config update is local-only' });
    }

    const nextWebapp = typeof req.body?.webappUrl === 'string' ? req.body.webappUrl.trim() : '';
    if (nextWebapp) {
        ctx.webappBaseUrl = nextWebapp.replace(/\/$/, '');
    }

    if (Array.isArray(req.body?.tunnelUrls)) {
        runtimeTunnelBaseUrls.clear();
        for (const value of req.body.tunnelUrls) {
            if (typeof value !== 'string') continue;
            const cleaned = value.trim().replace(/\/$/, '');
            if (cleaned) runtimeTunnelBaseUrls.add(cleaned);
        }
    }

    res.json({
        success: true,
        webappUrl: ctx.webappBaseUrl,
        tunnelUrls: getTunnelBaseUrls(),
    });
});

app.get('/api/system/pairing-config', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Pairing config query is local-only' });
    }
    res.json({
        webappUrl: ctx.webappBaseUrl,
        tunnelUrls: getTunnelBaseUrls(),
    });
});

// PUBLIC: Validate a pairing code and get a session token
app.post('/pair/validate', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Missing pairing code' });

    const token = validatePairingCode(code.toString().trim());
    if (!token) {
        return res.status(401).json({ error: 'Invalid or expired pairing code' });
    }

    if (!ctx.silentMode) console.log(`  ✅ Device paired successfully (code: ${code})`);
    res.json({ token, expiresIn: Math.round(SESSION_EXPIRY_MS / 1000), hostname: os.hostname() });
});

// PUBLIC: /api/pair — ConnectPage calls this with { code }
app.post('/api/pair', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const token = validatePairingCode(code.toString().trim());
    if (!token) return res.status(401).json({ error: 'Invalid or expired pairing code', success: false });
    if (!ctx.silentMode) console.log(`  Paired via /api/pair (code: ${code})`);
    res.json({ success: true, token, hostname: os.hostname(), expiresIn: Math.round(SESSION_EXPIRY_MS / 1000) });
});

// AUTHENTICATED: refresh daemon token before session expiry
app.post('/api/session/refresh-token', requireAuth, (req, res) => {
    const token = req.headers['x-soupz-token'] || req.query.token || req.body?.token;
    const force = req.body?.force === true;
    const refreshed = refreshSessionToken(token, { force });
    if (!refreshed.ok) {
        return res.status(refreshed.status || 400).json({ success: false, error: refreshed.error || 'Session refresh failed' });
    }
    res.json({
        success: true,
        token: refreshed.token,
        refreshed: refreshed.refreshed,
        createdAt: refreshed.createdAt,
        expiresIn: refreshed.expiresIn,
        hostname: os.hostname(),
    });
});

// AUTHENTICATED: Revoke session (logout)
app.post('/logout', requireAuth, (req, res) => {
    const token = req.headers['x-soupz-token'] || req.query.token;
    revokeSession(token);
    console.log('  🚪 Device disconnected (session revoked)');
    res.json({ ok: true });
});
