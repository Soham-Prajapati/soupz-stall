import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MCP_DIR = join(homedir(), '.soupz-agents', 'mcp');
const MCP_CONFIG = join(MCP_DIR, 'servers.json');

export class MCPClient extends EventEmitter {
    constructor() {
        super();
        if (!existsSync(MCP_DIR)) mkdirSync(MCP_DIR, { recursive: true });
        this.servers = this._loadConfig();
        this.connections = new Map();
    }

    _loadConfig() {
        try { return JSON.parse(readFileSync(MCP_CONFIG, 'utf8')); }
        catch { return {}; }
    }

    _saveConfig() {
        writeFileSync(MCP_CONFIG, JSON.stringify(this.servers, null, 2));
    }

    /** Register an MCP server */
    register(name, config) {
        // config: { command: 'npx', args: ['-y', '@stitch/mcp-server'], env: {} }
        this.servers[name] = { ...config, registered: new Date().toISOString() };
        this._saveConfig();
        return true;
    }

    /** Unregister an MCP server */
    unregister(name) {
        delete this.servers[name];
        this._saveConfig();
        this.disconnect(name);
    }

    /** List registered servers */
    list() {
        return Object.entries(this.servers).map(([name, config]) => ({
            name,
            command: config.command,
            connected: this.connections.has(name),
            ...config,
        }));
    }

    /** Connect to an MCP server (spawn process, establish JSON-RPC) */
    async connect(name) {
        const config = this.servers[name];
        if (!config) throw new Error(`MCP server "${name}" not registered`);
        if (this.connections.has(name)) return this.connections.get(name);

        return new Promise((resolve, reject) => {
            const proc = spawn(config.command, config.args || [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ...(config.env || {}) },
            });

            const conn = {
                process: proc,
                name,
                tools: [],
                pending: new Map(),
                nextId: 1,
            };

            let buffer = '';
            proc.stdout.on('data', (chunk) => {
                buffer += chunk.toString();
                // Parse JSON-RPC messages (newline-delimited)
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        if (msg.id && conn.pending.has(msg.id)) {
                            const { resolve, reject } = conn.pending.get(msg.id);
                            conn.pending.delete(msg.id);
                            if (msg.error) reject(new Error(msg.error.message));
                            else resolve(msg.result);
                        }
                        this.emit('message', name, msg);
                    } catch { /* ignore non-JSON lines */ }
                }
            });

            proc.stderr.on('data', (chunk) => {
                this.emit('stderr', name, chunk.toString());
            });

            proc.on('error', (err) => {
                this.connections.delete(name);
                reject(err);
            });

            proc.on('close', () => {
                this.connections.delete(name);
                this.emit('disconnected', name);
            });

            this.connections.set(name, conn);

            // Initialize: send initialize request
            this._send(conn, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'soupz-stall', version: '0.1.0-alpha' },
            }).then(result => {
                // Send initialized notification
                this._notify(conn, 'notifications/initialized', {});
                // List available tools
                return this._send(conn, 'tools/list', {});
            }).then(result => {
                conn.tools = result?.tools || [];
                this.emit('connected', name, conn.tools);
                resolve(conn);
            }).catch(err => {
                proc.kill();
                this.connections.delete(name);
                reject(err);
            });

            // Timeout
            setTimeout(() => {
                if (!conn.tools.length && conn.pending.size > 0) {
                    proc.kill();
                    this.connections.delete(name);
                    reject(new Error(`MCP server "${name}" timed out during init`));
                }
            }, 10000);
        });
    }

    /** Send a JSON-RPC request */
    _send(conn, method, params) {
        return new Promise((resolve, reject) => {
            const id = conn.nextId++;
            conn.pending.set(id, { resolve, reject });
            const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
            conn.process.stdin.write(msg);
        });
    }

    /** Send a JSON-RPC notification (no response expected) */
    _notify(conn, method, params) {
        const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
        conn.process.stdin.write(msg);
    }

    /** Call a tool on a connected MCP server */
    async callTool(serverName, toolName, args = {}) {
        const conn = this.connections.get(serverName);
        if (!conn) throw new Error(`Not connected to "${serverName}"`);
        return this._send(conn, 'tools/call', { name: toolName, arguments: args });
    }

    /** Get available tools from a connected server */
    getTools(serverName) {
        const conn = this.connections.get(serverName);
        return conn?.tools || [];
    }

    /** Get all tools across all connected servers */
    allTools() {
        const tools = [];
        for (const [name, conn] of this.connections) {
            for (const tool of conn.tools) {
                tools.push({ server: name, ...tool });
            }
        }
        return tools;
    }

    /** Disconnect from an MCP server */
    disconnect(name) {
        const conn = this.connections.get(name);
        if (conn) {
            try { conn.process.kill(); } catch {}
            this.connections.delete(name);
        }
    }

    /** Disconnect all */
    disconnectAll() {
        for (const [name] of this.connections) this.disconnect(name);
    }
}
