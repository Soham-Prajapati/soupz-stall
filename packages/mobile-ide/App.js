import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '7533';

export default function App() {
    const [screen, setScreen] = useState('pair'); // 'pair' | 'main'
    const [host, setHost] = useState(DEFAULT_HOST);
    const [port, setPort] = useState(DEFAULT_PORT);
    const [pairingCode, setPairingCode] = useState('');
    const [sessionToken, setSessionToken] = useState(null);
    const [connected, setConnected] = useState(false);
    const [terminals, setTerminals] = useState([]);
    const [activeTerminal, setActiveTerminal] = useState(null);
    const [health, setHealth] = useState(null);
    const [input, setInput] = useState('');
    const [outputs, setOutputs] = useState({});
    const [showHealth, setShowHealth] = useState(false);
    const [pairing, setPairing] = useState(false);
    const [hostname, setHostname] = useState('');
    const wsRef = useRef(null);
    const scrollRef = useRef(null);

    // Try to restore saved session on app launch
    useEffect(() => {
        try {
            // In a real app, use AsyncStorage. For now, just start fresh.
        } catch {}
    }, []);

    const pair = async () => {
        if (!pairingCode.trim() || pairingCode.trim().length < 6) {
            Alert.alert('Invalid Code', 'Enter the 8-digit pairing code shown on your laptop.');
            return;
        }
        setPairing(true);
        const serverBase = `http://${host}:${port}`;

        try {
            // Step 1: Validate pairing code via REST
            const res = await fetch(`${serverBase}/pair/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: pairingCode.trim() }),
            });
            const data = await res.json();

            if (!res.ok) {
                Alert.alert('Pairing Failed', data.error || 'Invalid or expired pairing code. Generate a new one on your laptop.');
                setPairing(false);
                return;
            }

            const token = data.token;
            setSessionToken(token);

            // Step 2: Connect WebSocket with token
            connectWebSocket(`ws://${host}:${port}`, token);
        } catch (err) {
            Alert.alert('Connection Error', `Could not reach server at ${serverBase}. Is it running?\n\n${err.message}`);
            setPairing(false);
        }
    };

    const connectWebSocket = (url, token) => {
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                // Send auth message immediately
                ws.send(JSON.stringify({ type: 'auth', token, clientType: 'mobile-ide' }));
            };

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                switch (msg.type) {
                    case 'auth_success':
                        setConnected(true);
                        setPairing(false);
                        setScreen('main');
                        setHostname(msg.hostname || '');
                        if (msg.health) setHealth(msg.health);
                        break;
                    case 'auth_failed':
                        Alert.alert('Auth Failed', msg.message || 'Session expired. Re-pair your device.');
                        setPairing(false);
                        disconnect();
                        break;
                    case 'health':
                        setHealth(msg.data);
                        break;
                    case 'terminal_created':
                        setTerminals(prev => [...prev, { id: msg.terminalId, pid: msg.pid }]);
                        setActiveTerminal(msg.terminalId);
                        setOutputs(prev => ({ ...prev, [msg.terminalId]: '' }));
                        break;
                    case 'output':
                    case 'history':
                        setOutputs(prev => ({
                            ...prev,
                            [msg.terminalId]: (prev[msg.terminalId] || '') + msg.data,
                        }));
                        break;
                    case 'exit':
                        setTerminals(prev => prev.filter(t => t.id !== msg.terminalId));
                        if (activeTerminal === msg.terminalId) setActiveTerminal(null);
                        break;
                    case 'logged_out':
                        disconnect();
                        Alert.alert('Logged Out', 'Session ended.');
                        break;
                }
            };

            ws.onclose = () => {
                setConnected(false);
                setPairing(false);
            };

            ws.onerror = () => {
                setPairing(false);
                Alert.alert('Connection Lost', 'WebSocket connection failed.');
            };
        } catch (err) {
            setPairing(false);
            Alert.alert('Error', err.message);
        }
    };

    const disconnect = () => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'logout' }));
            wsRef.current.close();
        }
        setConnected(false);
        setScreen('pair');
        setTerminals([]);
        setActiveTerminal(null);
        setSessionToken(null);
        setPairingCode('');
    };

    const createTerminal = () => {
        wsRef.current?.send(JSON.stringify({ type: 'create_terminal' }));
    };

    const killTerminal = (id) => {
        wsRef.current?.send(JSON.stringify({ type: 'kill_terminal', terminalId: id }));
    };

    const sendInput = (cmd) => {
        const text = cmd || input;
        if (!text.trim() || !activeTerminal) return;
        wsRef.current?.send(JSON.stringify({
            type: 'input',
            terminalId: activeTerminal,
            data: text + '\n',
        }));
        if (!cmd) setInput('');
    };

    const getMemoryColor = (percent) => {
        if (percent > 90) return '#e94560';
        if (percent > 70) return '#FFAA00';
        return '#4CAF50';
    };

    const recipes = [
        { label: '🫕 soupz', cmd: 'soupz' },
        { label: '🔨 build', cmd: 'npm run build' },
        { label: '🧪 test', cmd: 'npm test' },
        { label: '📁 status', cmd: 'git status' },
        { label: '🧹 clear', cmd: 'clear' },
    ];

    // ═══════════════════════════════════════
    // PAIRING SCREEN
    // ═══════════════════════════════════════
    if (screen === 'pair') {
        return (
            <View style={styles.container}>
                <View style={styles.pairScreen}>
                    <Text style={styles.logo}>🫕</Text>
                    <Text style={styles.title}>Soupz Cloud Kitchen</Text>
                    <Text style={styles.subtitle}>Remote terminal for your AI stall</Text>

                    <View style={styles.divider} />

                    <Text style={styles.stepLabel}>① Start the stove on your laptop:</Text>
                    <View style={styles.codeBlock}>
                        <Text style={styles.codeText}>cd packages/remote-server && npm start</Text>
                    </View>

                    <Text style={styles.stepLabel}>② Enter the order number (Pairing Code):</Text>
                    <TextInput
                        style={styles.otpInput}
                        value={pairingCode}
                        onChangeText={setPairingCode}
                        placeholder="• • • • • • • •"
                        placeholderTextColor="#333"
                        keyboardType="number-pad"
                        maxLength={8}
                        textAlign="center"
                        autoFocus
                    />

                    <Text style={styles.stepLabel}>Kitchen address (optional):</Text>
                    <View style={styles.hostRow}>
                        <TextInput
                            style={[styles.hostInput, { flex: 2 }]}
                            value={host}
                            onChangeText={setHost}
                            placeholder="IP or hostname"
                            placeholderTextColor="#555"
                            autoCapitalize="none"
                        />
                        <Text style={styles.colon}>:</Text>
                        <TextInput
                            style={[styles.hostInput, { flex: 1 }]}
                            value={port}
                            onChangeText={setPort}
                            placeholder="7533"
                            placeholderTextColor="#555"
                            keyboardType="number-pad"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.pairBtn, pairing && styles.pairBtnDisabled]}
                        onPress={() => pair()}
                        disabled={pairing}
                    >
                        <Text style={styles.pairBtnText}>
                            {pairing ? '🔄 Starting stove...' : '🔗 Pair with Kitchen'}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.footerHint}>
                        Order codes expire in 5 minutes.{'\n'}
                        Generate new: curl -X POST http://laptop:7533/pair
                    </Text>
                </View>
            </View>
        );
    }

    // ═══════════════════════════════════════
    // MAIN TERMINAL SCREEN
    // ═══════════════════════════════════════
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>🫕 Cloud Kitchen</Text>
                    <Text style={styles.headerStatus}>
                        {connected ? '🟢 Stove hot' : '🔴 Stove cold'} • {hostname || 'Remote'}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setShowHealth(!showHealth)} style={styles.headerActionBtn}>
                        <Text style={styles.headerBtnIcon}>
                            {health?.warnings?.length > 0 ? '⚠️' : '📊'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={createTerminal} style={styles.headerActionBtn}>
                        <Text style={styles.headerBtnIcon}>➕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={disconnect} style={styles.headerActionBtn}>
                        <Text style={[styles.headerBtnIcon, { color: '#e94560' }]}>⏻</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Health Panel (Thermometer) */}
            {showHealth && health && (
                <View style={styles.healthPanel}>
                    <View style={styles.healthHeader}>
                        <Text style={styles.healthTitle}>🌡️ Kitchen Thermometer</Text>
                        <Text style={styles.healthUptime}>Up: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</Text>
                    </View>
                    <View style={styles.healthRow}>
                        <Text style={styles.healthLabel}>RAM</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: `${health.memory.usagePercent}%`,
                                backgroundColor: getMemoryColor(health.memory.usagePercent)
                            }]} />
                        </View>
                        <Text style={[styles.healthValue, { color: getMemoryColor(health.memory.usagePercent) }]}>
                            {health.memory.usagePercent}%
                        </Text>
                    </View>
                    <View style={styles.healthRow}>
                        <Text style={styles.healthLabel}>CPU</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: `${Math.min(100, (health.cpu.loadAvg['1m'] / health.cpu.cores) * 100)}%`,
                                backgroundColor: '#4285F4'
                            }]} />
                        </View>
                        <Text style={styles.healthValue}>
                            {health.cpu.loadAvg['1m'].toFixed(1)}
                        </Text>
                    </View>
                    {health.cpu.temperature && (
                        <View style={styles.healthRow}>
                            <Text style={styles.healthLabel}>TEMP</Text>
                            <Text style={[styles.healthValue, health.cpu.temperature > 85 ? styles.warning : { color: '#FFAA00' }]}>
                                {health.cpu.temperature}°C
                            </Text>
                        </View>
                    )}
                    {health.warnings?.map((w, i) => (
                        <Text key={i} style={styles.warningText}>{w}</Text>
                    ))}
                </View>
            )}

            {/* Terminal Tabs */}
            <ScrollView horizontal style={styles.tabs} showsHorizontalScrollIndicator={false}>
                {terminals.map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tab, activeTerminal === t.id && styles.activeTab]}
                        onPress={() => setActiveTerminal(t.id)}
                        onLongPress={() => killTerminal(t.id)}
                    >
                        <Text style={[styles.tabText, activeTerminal === t.id && styles.activeTabText]}>
                            🍳 Station {t.id}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Terminal Output */}
            {activeTerminal ? (
                <ScrollView
                    ref={scrollRef}
                    style={styles.terminal}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
                >
                    <Text style={styles.terminalText} selectable>
                        {outputs[activeTerminal] || ''}
                    </Text>
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🍳</Text>
                    <Text style={styles.emptyText}>Kitchen is quiet</Text>
                    <Text style={styles.emptyHint}>Tap "➕" to open a new station</Text>
                </View>
            )}

            {/* Recipe Bar */}
            {activeTerminal && (
                <ScrollView horizontal style={styles.recipeBar} showsHorizontalScrollIndicator={false}>
                    {recipes.map((r, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.recipeBtn}
                            onPress={() => sendInput(r.cmd)}
                        >
                            <Text style={styles.recipeBtnText}>{r.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Input Bar */}
            {activeTerminal && (
                <View style={styles.inputBar}>
                    <Text style={styles.prompt}>$</Text>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={() => sendInput()}
                        placeholder="Add ingredients (commands)..."
                        placeholderTextColor="#444"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="send"
                    />
                    <TouchableOpacity onPress={() => sendInput()} style={styles.sendBtn}>
                        <Text style={styles.sendBtnText}>⏎</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },

    // Pairing Screen
    pairScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    logo: { fontSize: 72, marginBottom: 8 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
    divider: { width: '80%', height: 1, backgroundColor: '#333', marginVertical: 20 },
    stepLabel: { color: '#aaa', fontSize: 13, alignSelf: 'flex-start', marginBottom: 8, marginTop: 12 },
    codeBlock: {
        backgroundColor: '#0f0f23', paddingVertical: 10, paddingHorizontal: 16,
        borderRadius: 8, borderWidth: 1, borderColor: '#333', width: '100%', marginBottom: 8,
    },
    codeText: { color: '#33ff33', fontFamily: 'monospace', fontSize: 13 },
    otpInput: {
        width: '100%', backgroundColor: '#16213e', color: '#fff', padding: 18,
        borderRadius: 12, fontSize: 28, fontWeight: 'bold', letterSpacing: 8,
        borderWidth: 2, borderColor: '#e94560', marginBottom: 8, fontFamily: 'monospace',
    },
    hostRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 4 },
    hostInput: {
        backgroundColor: '#16213e', color: '#fff', padding: 12,
        borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#333',
    },
    colon: { color: '#666', fontSize: 18, fontWeight: 'bold' },
    pairBtn: {
        backgroundColor: '#e94560', paddingVertical: 16, paddingHorizontal: 48,
        borderRadius: 12, marginTop: 24, width: '100%', alignItems: 'center',
    },
    pairBtnDisabled: { opacity: 0.5 },
    pairBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    footerHint: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 18 },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, paddingTop: 56, backgroundColor: '#16213e', borderBottomWidth: 1, borderBottomColor: '#222',
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerStatus: { color: '#666', fontSize: 11, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    headerActionBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18, backgroundColor: '#1a1a2e' },
    headerBtnIcon: { fontSize: 14, color: '#fff' },

    // Health Panel (Thermometer)
    healthPanel: { backgroundColor: '#16213e', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
    healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    healthTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
    healthUptime: { color: '#444', fontSize: 11 },
    healthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    healthLabel: { color: '#888', width: 45, fontSize: 12, fontWeight: '600' },
    healthValue: { width: 50, fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
    progressBar: { flex: 1, height: 6, backgroundColor: '#0f0f23', borderRadius: 3, marginHorizontal: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    warning: { color: '#e94560' },
    warningText: { color: '#FFAA00', fontSize: 12, marginTop: 6, fontStyle: 'italic' },

    // Tabs
    tabs: { backgroundColor: '#16213e', maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#333' },
    tab: { paddingHorizontal: 16, paddingVertical: 12, marginRight: 2 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#e94560', backgroundColor: '#1a1a2e' },
    tabText: { color: '#555', fontSize: 12 },
    activeTabText: { color: '#fff', fontWeight: 'bold' },

    // Terminal
    terminal: { flex: 1, backgroundColor: '#0f0f23', padding: 12 },
    terminalText: { color: '#33ff33', fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },

    // Empty State
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { color: '#666', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
    emptyHint: { color: '#444', fontSize: 14 },

    // Recipe Bar
    recipeBar: { backgroundColor: '#16213e', maxHeight: 40, borderTopWidth: 1, borderTopColor: '#333', paddingVertical: 6 },
    recipeBtn: { backgroundColor: '#1a1a2e', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#333' },
    recipeBtnText: { color: '#aaa', fontSize: 11, fontWeight: '600' },

    // Input Bar
    inputBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e',
        padding: 6, borderTopWidth: 1, borderTopColor: '#333',
    },
    prompt: { color: '#e94560', fontSize: 18, fontWeight: 'bold', marginRight: 4, marginLeft: 8 },
    input: { flex: 1, color: '#fff', fontSize: 15, padding: 8, fontFamily: 'monospace' },
    sendBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    sendBtnText: { color: '#e94560', fontSize: 24 },
});
