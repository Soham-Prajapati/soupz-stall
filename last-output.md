# Agent 1 Output - Supabase Relay Verification

## Verification Steps
1. Checked `src/supabase-relay.js`:
   - Singleton export `export const relay = new SupabaseRelay()` is REMOVED.
   - Replaced with `export { SupabaseRelay }; export default SupabaseRelay;`.
2. Checked `src/session.js`:
   - `import SupabaseRelay from './supabase-relay.js';` imports the class correctly.
   - `this.relay = new SupabaseRelay();` is the first line of the constructor.
   - All `relay.X()` calls are changed to `this.relay.X()`.
3. Verified `src/auth/user-auth.js`:
   - No imports of `relay` found.
4. Run `soupz-stall` (node bin/soupz.js):
   - Output: `RELAY DEBUG: { url: 'SET', key: 'SET', enabled: true }`.
   - Fixed a `SyntaxError` in `src/session.js` where `statusLine` was redeclared.

## Terminal Output (Partial)
```
[dotenv@17.3.1] injecting env (7) from .env -- tip: ⚙️  specify custom .env file path with { path: '/custom/path/.env' }
ENV loaded: 7 vars
RELAY DEBUG: { url: 'SET', key: 'SET', enabled: true }

       ███████╗  ██████╗  ██╗   ██╗ ██████╗  ███████╗
       ██╔════╝ ██╔═══██╗ ██║   ██║ ██╔══██╗ ╚══███╔╝
       ███████╗ ██║   ██║ ██║   ██║ ██████╔╝   ███╔╝ 
       ╚════██║ ██║   ██║ ██║   ██║ ██╔═══╝   ███╔╝  
       ███████║ ╚██████╔╝ ╚██████╔╝ ██║      ███████╗
       ╚══════╝  ╚═════╝   ╚═════╝  ╚═╝      ╚══════╝
                    S  T  A  L  L  v0.1-alpha
```
