    // ── Interactive Session (Restored) ──────────────────────────────────────
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const { AgentSpawner } = await import('../src/agents/spawner.js');
    const { Orchestrator } = await import('../src/orchestrator/router.js');
    const { ContextManager } = await import('../src/context/manager.js');
    const { MemoryStore } = await import('../src/memory/store.js');
    const { GradingSystem } = await import('../src/grading/scorer.js');
    const { AuthManager } = await import('../src/auth/manager.js');
    const { UserAuth } = await import('../src/auth/user-auth.js');
    const { Session } = await import('../src/session.js');
    const { TokenCompressor } = await import('../src/core/token-compressor.js');
    const { StallMonitor } = await import('../src/core/stall-monitor.js');
    const { MCPClient } = await import('../src/mcp/client.js');
    const { MemoryPool } = await import('../src/memory/pool.js');

    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const mcpClient = new MCPClient();
    await mcpClient.init();
    const compressor = new TokenCompressor();
    const kitchenMonitor = new StallMonitor();
    const memory = new MemoryStore();
    await memory.init();
    const memoryPool = new MemoryPool();
    const auth = new AuthManager(registry);
    const userAuth = new UserAuth();
    await userAuth.init();
    const grading = new GradingSystem();
    const contextManager = new ContextManager();
    const orchestrator = new Orchestrator(registry, spawner, contextManager, memory, mcpClient);
    const cwd = process.cwd();

    // If we have a prompt argument passed as options.run or something... wait, the original code had "soupz-stall run"
    // Since we are restoring the REPL, we'll just start it:

    const session = new Session({ 
        registry, 
        spawner, 
        orchestrator, 
        contextManager, 
        memory, 
        grading, 
        auth, 
        userAuth, 
        cwd, 
        compressor, 
        kitchenMonitor, 
        mcpClient, 
        memoryPool 
    });
    if (options.yolo || options.dangerouslySkipPermissions) session.yolo = true;
    session.start();

    // Re-bind SIGINT/SIGTERM to kill the spawner along with the daemon
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');

    process.on('SIGINT', () => {
        if (activeCountdown) clearInterval(activeCountdown);
        console.log(chalk.dim('\n  Stopping daemon...'));
        serverInfo.stop();
        spawner.killAll();
        contextManager.save();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        if (activeCountdown) clearInterval(activeCountdown);
        serverInfo.stop();
        spawner.killAll();
        contextManager.save();
        process.exit(0);
    });
