import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import relay from '../supabase-relay.js';

const AUTH_DIR = join(homedir(), '.soupz-agents', 'auth');
const USER_FILE = join(AUTH_DIR, 'user.json');

// Default Supabase config — user can override via env vars
const SUPABASE_URL = process.env.SOUPZ_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SOUPZ_SUPABASE_KEY || '';

export class UserAuth {
    constructor() {
        if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });
        this.user = this._loadUser();
        if (this.user) {
            relay.setUser(this.user.id || this.user.email);
            void relay.registerMachine();
        }
        this.supabase = null;
        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        }
    }

    _loadUser() {
        try { return JSON.parse(readFileSync(USER_FILE, 'utf8')); }
        catch { return null; }
    }

    _saveUser(user) {
        this.user = user;
        writeFileSync(USER_FILE, JSON.stringify(user, null, 2));
        if (user) {
            relay.setUser(user.id || user.email);
            void relay.registerMachine();
        }
    }

    isLoggedIn() { return !!this.user?.id; }

    getUser() { return this.user; }

    /** Sign up with email/password */
    async signup(email, password) {
        if (!this.supabase) {
            // Local-only mode: create a local user with UUID
            const { randomUUID } = await import('crypto');
            const user = { id: randomUUID(), email, mode: 'local', createdAt: new Date().toISOString() };
            this._saveUser(user);
            return { success: true, user, mode: 'local' };
        }
        const { data, error } = await this.supabase.auth.signUp({ email, password });
        if (error) return { success: false, error: error.message };
        const user = { id: data.user.id, email: data.user.email, mode: 'supabase', createdAt: new Date().toISOString() };
        this._saveUser(user);
        return { success: true, user, mode: 'supabase' };
    }

    /** Login with email/password */
    async login(email, password) {
        if (!this.supabase) {
            // Local mode: check if user file exists with that email
            if (this.user?.email === email) {
                return { success: true, user: this.user, mode: 'local' };
            }
            return { success: false, error: 'No local account found. Run signup first.' };
        }
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) return { success: false, error: error.message };
        const user = { id: data.user.id, email: data.user.email, mode: 'supabase', lastLogin: new Date().toISOString() };
        this._saveUser(user);
        return { success: true, user, mode: 'supabase' };
    }

    /** Logout */
    async logout() {
        if (this.supabase) {
            await this.supabase.auth.signOut().catch(() => {});
        }
        this.user = null;
        try { const { unlinkSync } = await import('fs'); unlinkSync(USER_FILE); } catch {}
        return { success: true };
    }

    /** Record a session event (for telemetry) */
    async recordEvent(event, data = {}) {
        if (!this.supabase || !this.user?.id) return;
        try {
            await this.supabase.from('events').insert({
                user_id: this.user.id,
                event,
                data,
                created_at: new Date().toISOString(),
            });
        } catch { /* telemetry is best-effort */ }
    }

    /** Get active user count (from Supabase) */
    async getActiveUsers() {
        if (!this.supabase) return { count: this.user ? 1 : 0, mode: 'local' };
        try {
            const { count } = await this.supabase.from('events')
                .select('user_id', { count: 'exact', head: true })
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
            return { count: count || 0, mode: 'supabase' };
        } catch { return { count: 0, mode: 'error' }; }
    }
}
