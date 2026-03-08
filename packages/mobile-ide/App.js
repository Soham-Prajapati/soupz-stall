import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, StatusBar, KeyboardAvoidingView, Platform, Vibration } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

// Safe storage wrapper
let _storage = null;
try { _storage = require('@react-native-async-storage/async-storage').default; } catch {}
const Storage = {
    async getItem(key) { try { return _storage ? await _storage.getItem(key) : null; } catch { return null; } },
    async setItem(key, val) { try { if (_storage) await _storage.setItem(key, val); } catch {} },
    async removeItem(key) { try { if (_storage) await _storage.removeItem(key); } catch {} },
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '7533';

const buzz = () => { try { Vibration.vibrate(10); } catch {} };

// Strip ANSI escape sequences and clean terminal output for mobile display
const stripAnsi = (str) => {
    let s = str;
    // ESC [ ... letter  (CSI sequences — colors, cursor, etc.)
    s = s.replace(/\x1b\[[0-9;:]*[A-Za-z]/g, '');
    // Orphaned CSI params (when ESC was already stripped but [nn;nn;nnm remains)
    s = s.replace(/\[(?:\d+;)*\d*m/g, '');
    // OSC sequences  ESC ] ... BEL/ST
    s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
    // Other ESC sequences
    s = s.replace(/\x1b[()#][A-Za-z0-9]/g, '');
    s = s.replace(/\x1b[A-Za-z]/g, '');
    // Remaining control chars (except newline/tab)
    s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    // Box-drawing → simple ASCII
    s = s.replace(/[┌┐└┘╔╗╚╝┏┓┗┛╭╮╰╯]/g, '+');
    s = s.replace(/[─━═╌╍┄┅┈┉]/g, '-');
    s = s.replace(/[│┃║╎╏┆┇┊┋]/g, '|');
    s = s.replace(/[├┤┣┫╠╣╞╡]/g, '|');
    s = s.replace(/[┬┴┳┻╦╩]/g, '-');
    s = s.replace(/[┼╋╬]/g, '+');
    // Collapse excessive dashes/borders into cleaner separators
    s = s.replace(/[+\-|]{20,}/g, (m) => '-'.repeat(Math.min(m.length, 40)));
    // Clean line endings
    s = s.replace(/\r\n/g, '\n');
    s = s.replace(/\r/g, '');
    // Collapse multiple blank lines
    s = s.replace(/\n{4,}/g, '\n\n');
    return s;
};

export default function App() {
    const [screen, setScreen] = useState('pair');
    const [theme, setTheme] = useState('kitchen'); // 'kitchen' or 'brutal'
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
    const [latency, setLatency] = useState(null);
    const wsRef = useRef(null);
    const scrollRef = useRef(null);
    const pingRef = useRef(null);

    const toggleTheme = () => { buzz(); setTheme(prev => prev === 'kitchen' ? 'brutal' : 'kitchen'); };

    useEffect(() => {
        const restore = async () => {
            try {
                const saved = await Storage.getItem('soupz_session');
                if (saved) {
                    const { host: h, port: p, token } = JSON.parse(saved);
                    if (h && p && token) {
                        setHost(h); setPort(p); setSessionToken(token);
                        try {
                            const check = await Promise.race([
                                fetch(`http://${h}:${p}/health`),
                                new Promise((_, rej) => setTimeout(() => rej(), 3000)),
                            ]);
                            if (check.ok) connectWebSocket(`ws://${h}:${p}`, token);
                        } catch {}
                    }
                }
            } catch {}
        };
        restore();
    }, []);

    useEffect(() => {
        if (!connected) return;
        const iv = setInterval(() => {
            if (wsRef.current?.readyState === 1) {
                pingRef.current = Date.now();
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, 5000);
        return () => clearInterval(iv);
    }, [connected]);

    const pair = async () => {
        if (!pairingCode.trim() || pairingCode.trim().length < 6) {
            Alert.alert('Invalid Code', 'Enter the 6-8 digit code shown in soupz-stall.');
            return;
        }
        const h = host.trim() || 'localhost';
        const p = port.trim() || '7533';
        const serverBase = `http://${h}:${p}`;
        setPairing(true);

        try {
            const healthCheck = await Promise.race([
                fetch(`${serverBase}/health`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
            ]);
            if (!healthCheck.ok) throw new Error('Server not responding');
        } catch {
            const tip = h === 'localhost' || h === '127.0.0.1'
                ? 'Using "localhost" only works in simulators. Enter your laptop IP.'
                : `Cannot reach ${serverBase}. Check WiFi.`;
            Alert.alert('Server Unreachable', tip);
            setPairing(false); return;
        }

        try {
            const res = await fetch(`${serverBase}/pair/validate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: pairingCode.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                Alert.alert('Pairing Failed', data.error || 'Invalid code.');
                setPairing(false); return;
            }
            const token = data.token;
            setSessionToken(token);
            await Storage.setItem('soupz_session', JSON.stringify({ host: h, port: p, token }));
            connectWebSocket(`ws://${h}:${p}`, token);
        } catch (err) {
            Alert.alert('Connection Error', err.message);
            setPairing(false);
        }
    };

    const connectWebSocket = (url, token) => {
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;
            ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token, clientType: 'mobile-ide' }));
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                switch (msg.type) {
                    case 'auth_success':
                        setConnected(true); setPairing(false); setScreen('main');
                        setHostname(msg.hostname || '');
                        if (msg.health) setHealth(msg.health);
                        break;
                    case 'auth_failed':
                        Alert.alert('Auth Failed', 'Session expired.');
                        setPairing(false); disconnect(); break;
                    case 'health': setHealth(msg.data); break;
                    case 'terminal_created':
                        setTerminals(prev => [...prev, { id: msg.terminalId, pid: msg.pid }]);
                        setActiveTerminal(msg.terminalId);
                        setOutputs(prev => ({ ...prev, [msg.terminalId]: '' }));
                        break;
                    case 'output':
                    case 'history':
                        setOutputs(prev => {
                            let combined = (prev[msg.terminalId] || '') + stripAnsi(msg.data);
                            if (combined.length > 50000) combined = combined.slice(-40000);
                            return { ...prev, [msg.terminalId]: combined };
                        });
                        break;
                    case 'exit':
                        setTerminals(prev => prev.filter(t => t.id !== msg.terminalId));
                        if (activeTerminal === msg.terminalId) setActiveTerminal(null);
                        break;
                    case 'logged_out': disconnect(); break;
                    case 'pong': if (pingRef.current) setLatency(Date.now() - pingRef.current); break;
                }
            };
            ws.onclose = () => { setConnected(false); setPairing(false); setLatency(null); };
            ws.onerror = () => { setPairing(false); if (connected) Alert.alert('Connection Lost'); };
        } catch (err) { setPairing(false); Alert.alert('Error', err.message); }
    };

    const disconnect = () => {
        if (wsRef.current) { try { wsRef.current.send(JSON.stringify({ type: 'logout' })); } catch {} wsRef.current.close(); }
        Storage.removeItem('soupz_session').catch(() => {});
        setConnected(false); setScreen('pair'); setTerminals([]); setActiveTerminal(null);
        setSessionToken(null); setPairingCode('');
    };

    const createTerminal = () => wsRef.current?.send(JSON.stringify({ type: 'create_terminal' }));
    const killTerminal = (id) => {
        Alert.alert('Close Station?', `Kill terminal ${id}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Kill', style: 'destructive', onPress: () => { buzz(); wsRef.current?.send(JSON.stringify({ type: 'kill_terminal', terminalId: id })); }},
        ]);
    };

    const sendInput = (cmd) => {
        const text = cmd || input;
        if (!text.trim() || !activeTerminal) return;
        wsRef.current?.send(JSON.stringify({ type: 'input', terminalId: activeTerminal, data: text + '\n' }));
        if (!cmd) setInput('');
    };

    const sendRaw = (char) => {
        if (!activeTerminal) return;
        wsRef.current?.send(JSON.stringify({ type: 'input', terminalId: activeTerminal, data: char }));
    };

    const specialKeys = [
        { label: 'Ctrl+C', char: '\x03' }, { label: 'Ctrl+D', char: '\x04' },
        { label: 'Tab', char: '\t' }, { label: '↑', char: '\x1b[A' },
        { label: '↓', char: '\x1b[B' }, { label: 'Ctrl+L', char: '\x0c' },
    ];

    const clearTerminal = () => {
        if (activeTerminal) {
            setOutputs(prev => ({ ...prev, [activeTerminal]: '' }));
            wsRef.current?.send(JSON.stringify({ type: 'input', terminalId: activeTerminal, data: 'clear\n' }));
        }
    };

    const recipes = [
        { label: '🫕 soupz', cmd: 'soupz-stall' },
        { label: '🔨 build', cmd: 'npm run build' },
        { label: '🧪 test', cmd: 'npm test' },
        { label: '📁 status', cmd: 'git status' },
        { label: '🧹 clear', action: clearTerminal },
    ];

    if (screen === 'pair') {
        const themeBg = theme === 'kitchen' ? '#ffffff' : '#f8f9fa';
        const cardBg = theme === 'kitchen' ? '#fffdf5' : '#ffffff';
        const accent = theme === 'kitchen' ? '#34c759' : '#007aff';

        return (
            <SafeAreaProvider>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: themeBg }]}>
                <StatusBar barStyle="dark-content" backgroundColor={themeBg} />
                <View style={[styles.pairScreen, { backgroundColor: themeBg }]}>
                    <TouchableOpacity style={styles.themeBadge} onPress={toggleTheme}>
                        <Text style={styles.themeBadgeText}>{theme === 'kitchen' ? 'KITCHEN MODE' : 'BRUTAL MODE'}</Text>
                    </TouchableOpacity>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <Text style={styles.logo}>🫕</Text>
                        <Text style={styles.title}>KITCHEN BRIDGE</Text>
                        <Text style={styles.subtitle}>Cloud Station Link</Text>
                        
                        <View style={styles.divider} />

                        <Text style={styles.stepLabel}>1. START THE STOVE</Text>
                        <View style={[styles.codeBlock, { backgroundColor: theme === 'kitchen' ? '#34c759' : '#ffd60a' }]}><Text style={styles.codeText}>soupz-stall → /cloud-kitchen</Text></View>

                        <Text style={styles.stepLabel}>2. ENTER KITCHEN IP</Text>
                        <View style={styles.hostRow}>
                            <TextInput style={[styles.inputField, { flex: 2 }]} value={host} onChangeText={setHost} placeholder="192.168.x.x" placeholderTextColor="#aaa" autoCapitalize="none" />
                            <Text style={styles.colon}>:</Text>
                            <TextInput style={[styles.inputField, { flex: 1 }]} value={port} onChangeText={setPort} placeholder="7533" placeholderTextColor="#aaa" keyboardType="number-pad" />
                        </View>

                        <Text style={[styles.stepLabel, { marginTop: 16 }]}>3. ENTER ORDER TICKET</Text>
                        <TextInput style={styles.otpInput} value={pairingCode} onChangeText={setPairingCode} placeholder="••••••••" placeholderTextColor="#ccc" keyboardType="number-pad" maxLength={8} />

                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={() => { buzz(); pair(); }} disabled={pairing}>
                            <Text style={styles.primaryBtnText}>{pairing ? 'CONNECTING...' : 'LINK STATION'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    const headerBg = theme === 'kitchen' ? '#ffffff' : '#ffd60a';
    const bodyBg = theme === 'kitchen' ? '#fcfcfc' : '#f8f9fa';

    return (
        <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: bodyBg }]}>
            <StatusBar barStyle="dark-content" backgroundColor={headerBg} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={[styles.container, { backgroundColor: bodyBg }]}>
                    
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: headerBg }]}>
                        <View>
                            <TouchableOpacity onPress={toggleTheme}><Text style={styles.headerTitle}>🫕 {theme === 'kitchen' ? 'KITCHEN' : 'STATION'}</Text></TouchableOpacity>
                            <View style={styles.statusBadge}>
                                <View style={[styles.statusDot, connected ? styles.statusOn : styles.statusOff]} />
                                <Text style={styles.headerStatus}>{connected ? 'LINK ACTIVE' : 'OFFLINE'}</Text>
                            </View>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => { buzz(); setShowHealth(!showHealth); }} style={styles.actionBtn}>
                                <Text style={styles.actionIcon}>📊</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { buzz(); createTerminal(); }} style={styles.actionBtn}>
                                <Text style={styles.actionIcon}>➕</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { buzz(); disconnect(); }} style={[styles.actionBtn, { backgroundColor: '#ff3b30' }]}>
                                <Text style={[styles.actionIcon, { color: '#fff' }]}>⏻</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Health Panel */}
                    {showHealth && health && (
                        <View style={styles.healthPanel}>
                            <Text style={styles.healthTitle}>SYSTEM HEALTH</Text>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthLabel}>CPU</Text>
                                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${health.cpu.loadAvg['1m'] * 10}%`, backgroundColor: '#007aff' }]} /></View>
                                <Text style={styles.healthValue}>{health.cpu.loadAvg['1m'].toFixed(1)}</Text>
                            </View>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthLabel}>RAM</Text>
                                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${health.memory.usagePercent}%`, backgroundColor: '#ff3b30' }]} /></View>
                                <Text style={styles.healthValue}>{health.memory.usagePercent}%</Text>
                            </View>
                        </View>
                    )}

                    {/* Tabs */}
                    <View style={styles.tabContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {terminals.map(t => (
                                <TouchableOpacity key={t.id} style={[styles.tab, activeTerminal === t.id && styles.activeTab]} onPress={() => { buzz(); setActiveTerminal(t.id); }} onLongPress={() => killTerminal(t.id)}>
                                    <Text style={[styles.tabText, activeTerminal === t.id && styles.activeTabText]}>STOVE {t.id}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Terminal */}
                    {activeTerminal ? (
                        <View style={styles.terminalWrapper}>
                            <ScrollView ref={scrollRef} style={styles.terminal} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
                                <Text style={styles.terminalText} selectable>{outputs[activeTerminal] || 'Awaiting orders...'}</Text>
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>🍳</Text>
                            <Text style={styles.emptyText}>STATION IS IDLE</Text>
                            <TouchableOpacity onPress={() => { buzz(); createTerminal(); }} style={styles.createBtn}>
                                <Text style={styles.createText}>NEW TICKET</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Bars */}
                    {activeTerminal && (
                        <View style={styles.controlsArea}>
                            <ScrollView horizontal style={styles.scrollBar} showsHorizontalScrollIndicator={false}>
                                {recipes.map((r, i) => (
                                    <TouchableOpacity key={i} style={styles.pillBtn} onPress={() => { buzz(); r.action ? r.action() : sendInput(r.cmd); }}>
                                        <Text style={styles.pillText}>{r.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <ScrollView horizontal style={styles.scrollBar} showsHorizontalScrollIndicator={false}>
                                {specialKeys.map((k, i) => (
                                    <TouchableOpacity key={i} style={styles.pillBtnAlt} onPress={() => { buzz(); sendRaw(k.char); }}>
                                        <Text style={styles.pillTextAlt}>{k.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={styles.inputArea}>
                                <Text style={styles.promptSign}>$</Text>
                                <TextInput style={styles.mainInput} value={input} onChangeText={setInput} onSubmitEditing={() => { buzz(); sendInput(); }} placeholder="Type command..." placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false} returnKeyType="send" />
                                <TouchableOpacity onPress={() => { buzz(); sendInput(); }} style={styles.sendBtn}>
                                    <Text style={styles.sendIcon}>⏎</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    container: { flex: 1, backgroundColor: '#f8f9fa' },

    themeBadge: { position: 'absolute', top: 20, right: 20, zIndex: 100, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
    themeBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },

    // Pairing (Neo-Brutalist)
    pairScreen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8f9fa' },
    card: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#000', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 },
    logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
    title: { fontSize: 24, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 4, letterSpacing: -0.5 },
    subtitle: { fontSize: 12, fontWeight: '700', color: '#666', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 },
    divider: { height: 3, backgroundColor: '#000', marginBottom: 20 },
    
    stepLabel: { fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
    codeBlock: { backgroundColor: '#ffd60a', borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 12, marginBottom: 16 },
    codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, fontWeight: '800', color: '#000' },
    
    hostRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    inputField: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: '700', color: '#000' },
    colon: { fontSize: 20, fontWeight: '900', color: '#000' },
    
    otpInput: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#000', borderRadius: 12, padding: 20, fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', letterSpacing: 10, shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, marginBottom: 24 },
    
    primaryBtn: { backgroundColor: '#007aff', borderWidth: 3, borderColor: '#000', borderRadius: 12, padding: 18, shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#ffd60a', borderBottomWidth: 3, borderBottomColor: '#000' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#000' },
    statusDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#000' },
    statusOn: { backgroundColor: '#34c759' }, statusOff: { backgroundColor: '#ff3b30' },
    headerStatus: { fontSize: 9, fontWeight: '900', color: '#000', textTransform: 'uppercase' },
    headerActions: { flexDirection: 'row', gap: 10 },
    actionBtn: { width: 40, height: 40, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
    actionIcon: { fontSize: 18, color: '#000' },

    // Health
    healthPanel: { backgroundColor: '#fff', borderBottomWidth: 3, borderBottomColor: '#000', padding: 16 },
    healthTitle: { fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', marginBottom: 12 },
    healthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    healthLabel: { width: 40, fontSize: 10, fontWeight: '900', color: '#666' },
    progressTrack: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#000', borderRadius: 4, marginHorizontal: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    healthValue: { width: 40, fontSize: 10, fontWeight: '900', color: '#000', textAlign: 'right' },

    // Tabs
    tabContainer: { backgroundColor: '#fff', borderBottomWidth: 3, borderBottomColor: '#000' },
    tab: { paddingHorizontal: 20, paddingVertical: 14, borderRightWidth: 2, borderRightColor: '#000' },
    activeTab: { backgroundColor: '#34c759' },
    tabText: { fontSize: 12, fontWeight: '900', color: '#666', textTransform: 'uppercase' },
    activeTabText: { color: '#000' },

    // Terminal
    terminalWrapper: { flex: 1, backgroundColor: '#1a1a2e', margin: 12, borderWidth: 3, borderColor: '#000', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
    terminal: { flex: 1, padding: 14 },
    terminalText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, fontWeight: '500', color: '#e0e0e0', lineHeight: 18 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { fontSize: 18, fontWeight: '900', color: '#ccc', textTransform: 'uppercase' },
    createBtn: { marginTop: 24, backgroundColor: '#ffd60a', borderWidth: 3, borderColor: '#000', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
    createText: { fontSize: 14, fontWeight: '900', color: '#000' },

    // Controls
    controlsArea: { backgroundColor: '#fff', borderTopWidth: 3, borderTopColor: '#000', padding: 12, gap: 12 },
    scrollBar: { flexGrow: 0 },
    pillBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
    pillText: { fontSize: 11, fontWeight: '900', color: '#000', textTransform: 'uppercase' },
    pillBtnAlt: { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#000', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
    pillTextAlt: { fontSize: 10, fontWeight: '800', color: '#666', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    
    inputArea: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    promptSign: { fontSize: 20, fontWeight: '900', color: '#ff3b30' },
    mainInput: { flex: 1, backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: '700', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    sendBtn: { width: 50, height: 50, backgroundColor: '#007aff', borderWidth: 2, borderColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
    sendIcon: { fontSize: 20, color: '#fff', fontWeight: '900' },
});