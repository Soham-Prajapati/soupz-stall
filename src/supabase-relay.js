import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import os from 'os';

class SupabaseRelay {
  constructor() {
    const url = process.env.SOUPZ_SUPABASE_URL 
      || process.env.SUPABASE_URL;
    const key = process.env.SOUPZ_SUPABASE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.enabled = !!(url && key);
    this.supabase = this.enabled
      ? createClient(url, key)
      : null;
    this.machineId = this._getMachineId();
    this.userId = null;
    this.heartbeatInterval = null;
  }

  _getMachineId() {
    return `machine-${os.hostname()}-${os.userInfo().username}`
      .replace(/[^a-zA-Z0-9-]/g, '-');
  }

  setUser(userId) {
    this.userId = userId;
  }

  async registerMachine() {
    if (!this.enabled || !this.userId) return;
    try {
      await this.supabase.from('soupz_machines').upsert({
        id: this.machineId,
        user_id: this.userId,
        name: os.hostname(),
        last_seen: new Date().toISOString(),
        status: 'online',
        version: process.env.npm_package_version || '0.1.0'
      });
      this._startHeartbeat();
    } catch {}
  }

  _startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(async () => {
      if (!this.enabled) return;
      try {
        await this.supabase.from('soupz_machines').upsert({
          id: this.machineId,
          user_id: this.userId,
          last_seen: new Date().toISOString(),
          status: 'online'
        });
      } catch {}
    }, 30000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  async stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (!this.enabled || !this.userId) return;
    try {
      await this.supabase.from('soupz_machines').upsert({
        id: this.machineId,
        user_id: this.userId,
        last_seen: new Date().toISOString(),
        status: 'offline'
      });
    } catch {}
  }

  async createOrder({ id, prompt, agent, runAgent, modelPolicy }) {
    if (!this.enabled) return;
    try {
      await this.supabase.from('soupz_orders').upsert({
        id,
        prompt,
        agent,
        run_agent: runAgent,
        model_policy: modelPolicy || 'auto',
        status: 'running',
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        user_id: this.userId,
        machine_id: this.machineId,
        source: 'cli',
        events: []
      });
    } catch {}
  }

  async pushChunk(orderId, chunk) {
    if (!this.enabled) return;
    try {
      await this.supabase.from('soupz_output_chunks').insert({
        order_id: orderId,
        chunk,
        created_at: new Date().toISOString()
      });
    } catch {}
  }

  async completeOrder({ 
    id, stdout, stderr, exitCode, 
    durationMs, gradeScore, linesGenerated,
    tokensUsed, tokensSaved 
  }) {
    if (!this.enabled) return;
    try {
      await this.supabase.from('soupz_orders').update({
        status: exitCode === 0 ? 'done' : 'failed',
        finished_at: new Date().toISOString(),
        stdout,
        stderr,
        exit_code: exitCode,
        duration_ms: durationMs,
        grade_score: gradeScore || 0,
        lines_generated: linesGenerated || 0,
        tokens_used: tokensUsed || 0,
        tokens_saved: tokensSaved || 0
      }).eq('id', id);
      await this._updatePlatformStats({
        tokensUsed: tokensUsed || 0,
        tokensSaved: tokensSaved || 0,
        linesGenerated: linesGenerated || 0,
        success: exitCode === 0
      });
    } catch {}
  }

  async pollPendingOrders() {
    if (!this.enabled || !this.userId) return [];
    try {
      const { data } = await this.supabase
        .from('soupz_orders')
        .select('*')
        .eq('machine_id', this.machineId)
        .eq('status', 'pending')
        .eq('source', 'dashboard')
        .order('created_at', { ascending: true })
        .limit(5);
      return data || [];
    } catch { return []; }
  }

  async _updatePlatformStats({ 
    tokensUsed, tokensSaved, linesGenerated, success 
  }) {
    if (!this.enabled) return;
    try {
      await this.supabase.rpc('increment_platform_stats', {
        p_tokens_used: tokensUsed,
        p_tokens_saved: tokensSaved,
        p_lines_generated: linesGenerated,
        p_success: success
      });
    } catch {}
  }
}

export { SupabaseRelay };
export default SupabaseRelay;
