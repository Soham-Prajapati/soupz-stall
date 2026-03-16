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
    // CSI sequences including DEC private mode (ESC[?..., ESC[>..., ESC[!...)
    s = s.replace(/\x1b\[[?!>]?[\d;:]*[A-Za-z~]/g, '');
    // OSC sequences  ESC ] ... BEL/ST
    s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
    // Character set designation: ESC ( B, ESC # 8, etc.
    s = s.replace(/\x1b[()#][A-Za-z0-9]/g, '');
    // ESC + single char (=, >, M, c, 7, 8, etc.)
    s = s.replace(/\x1b[^\[\]]/g, '');
    // Orphaned CSI (ESC stripped in transit): [params letter
    s = s.replace(/\[[\d;:?!>]*[A-Za-z~]/g, '');
    // Orphaned CSI color codes ending in m (broader catch)
    s = s.replace(/\[(?:\d+;)*\d*m/g, '');
    // Remaining control chars (keep \n, \r, \t)
    s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    // Full-block / shade characters → compact
    s = s.replace(/[██]+/g, (m) => '█'.repeat(Math.min(m.length, 8)));
    s = s.replace(/[░▒▓]/g, '·');
    // Box-drawing → simple ASCII
    s = s.replace(/[┌┐└┘╔╗╚╝┏┓┗┛╭╮╰╯]/g, '+');
    s = s.replace(/[─━═╌╍┄┅┈┉]/g, '-');
    s = s.replace(/[│┃║╎╏┆┇┊┋]/g, '|');
    s = s.replace(/[├┤┣┫╠╣╞╡]/g, '|');
    s = s.replace(/[┬┴┳┻╦╩]/g, '-');
    s = s.replace(/[┼╋╬]/g, '+');
    // Collapse excessive dashes/borders into cleaner separators
    s = s.replace(/[+\-|]{20,}/g, (m) => '-'.repeat(Math.min(m.length, 30)));
    // Collapse multiple blank lines
    s = s.replace(/\n{4,}/g, '\n\n');
    return s;
};

// Process carriage returns — \r without \n means "overwrite from line start"
const processCarriageReturn = (text) => {
    // First: normalize \r\n → \n
    let s = text.replace(/\r\n/g, '\n');
    // If no standalone \r remains, nothing to do
    if (!s.includes('\r')) return s;
    // Process each line
    const lines = s.split('\n');
    const processed = lines.map(line => {
        if (!line.includes('\r')) return line;
        // Each \r resets cursor to column 0; following text overwrites
        const segments = line.split('\r');
        let result = '';
        for (const seg of segments) {
            if (seg === '') continue;
            // Overwrite result from position 0
            const resultChars = [...result];
            const newChars = [...seg];
            for (let i = 0; i < newChars.length; i++) {
                resultChars[i] = newChars[i];
            }
            result = resultChars.join('');
        }
        return result;
    });
    return processed.join('\n');
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
    const lastInputRef = useRef('');

    const toggleTheme = () => { 
        buzz(); 
        const modes = ['kitchen', 'brutal', 'skeuo', 'neo', 'glass'];
        const next = modes[(modes.indexOf(theme) + 1) % modes.length];
        setTheme(next); 
        Storage.setItem('soupz_theme', next).catch(() => {});
    };

    const isKitchen = theme === 'kitchen';
    const isSkeuo = theme === 'skeuo';
    const isNeo = theme === 'neo';
    const isGlass = theme === 'glass';
    const isSoft = isSkeuo || isNeo || isGlass; // non-brutal themes
    const themeLabels = { kitchen: 'KITCHEN', brutal: 'BRUTAL', skeuo: 'CLASSIC', neo: 'SOFT UI', glass: 'GLASS' };
    const activeStyles = {
        card: isGlass ? styles.cardGlass : isNeo ? styles.cardNeo : isSkeuo ? styles.cardSkeuo : (isKitchen ? styles.cardKitchen : styles.cardBrutal),
        btnPrimary: isGlass ? styles.btnPrimaryGlass : isNeo ? styles.btnPrimaryNeo : isSkeuo ? styles.btnPrimarySkeuo : (isKitchen ? styles.btnPrimaryKitchen : styles.btnPrimaryBrutal),
        header: isGlass ? styles.headerGlass : isNeo ? styles.headerNeo : isSkeuo ? styles.headerSkeuo : (isKitchen ? styles.headerKitchen : styles.headerBrutal),
        actionBtn: isGlass ? styles.actionBtnGlass : isNeo ? styles.actionBtnNeo : isSkeuo ? styles.actionBtnSkeuo : (isKitchen ? styles.actionBtnKitchen : styles.actionBtnBrutal),
        terminalWrap: isGlass ? styles.terminalWrapGlass : isNeo ? styles.terminalWrapNeo : isSkeuo ? styles.terminalWrapSkeuo : (isKitchen ? styles.terminalWrapKitchen : styles.terminalWrapBrutal),
        pillBtn: isGlass ? styles.pillBtnGlass : isNeo ? styles.pillBtnNeo : isSkeuo ? styles.pillBtnSkeuo : (isKitchen ? styles.pillBtnKitchen : styles.pillBtnBrutal),
        inputArea: isGlass ? styles.inputAreaGlass : isNeo ? styles.inputAreaNeo : isSkeuo ? styles.inputAreaSkeuo : (isKitchen ? styles.inputAreaKitchen : styles.inputAreaBrutal),
        sendBtn: isGlass ? styles.sendBtnGlass : isNeo ? styles.sendBtnNeo : isSkeuo ? styles.sendBtnSkeuo : (isKitchen ? styles.sendBtnKitchen : styles.sendBtnBrutal),
        themeBadge: styles.themeBadge,
    };

    useEffect(() => {
        const restore = async () => {
            try {
                const savedTheme = await Storage.getItem('soupz_theme');
                if (savedTheme) setTheme(savedTheme);

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
                            const stripped = stripAnsi(msg.data);
                            let combined = (prev[msg.terminalId] || '') + stripped;
                            combined = processCarriageReturn(combined);
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
        if (!cmd) { setInput(''); lastInputRef.current = ''; }
    };

    const sendRaw = (char) => {
        if (!activeTerminal) return;
        wsRef.current?.send(JSON.stringify({ type: 'input', terminalId: activeTerminal, data: char }));
    };

    // Raw mode: send each character as typed (like a real terminal)
    const handleRawInput = (newText) => {
        if (!activeTerminal) { setInput(newText); return; }
        const prev = lastInputRef.current;
        if (newText.length > prev.length) {
            // New character(s) typed — send immediately
            const added = newText.slice(prev.length);
            sendRaw(added);
        } else if (newText.length < prev.length) {
            // Backspace — send DEL for each deleted char
            const count = prev.length - newText.length;
            for (let i = 0; i < count; i++) sendRaw('\x7f');
        }
        lastInputRef.current = newText;
        setInput(newText);
    };

    const handleRawSubmit = () => {
        buzz();
        sendRaw('\n');
        setInput('');
        lastInputRef.current = '';
    };

    const specialKeys = [
        { label: '⇥ Tab', char: '\t' },
        { label: '←', char: '\x1b[D' }, { label: '→', char: '\x1b[C' },
        { label: '↑', char: '\x1b[A' }, { label: '↓', char: '\x1b[B' },
        { label: 'Esc', char: '\x1b' },
        { label: 'Ctrl+C', char: '\x03' }, { label: 'Ctrl+D', char: '\x04' },
        { label: 'Ctrl+L', char: '\x0c' }, { label: 'Ctrl+Z', char: '\x1a' },
        { label: 'Ctrl+A', char: '\x01' }, { label: 'Ctrl+E', char: '\x05' },
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
        const themeBg = isGlass ? '#4a3a6a' : isNeo ? '#e0e5ec' : isSkeuo ? '#e0e0e0' : isKitchen ? '#ffffff' : '#f8f9fa';
        const cardBg = isGlass ? 'rgba(255,255,255,0.12)' : isNeo ? '#e0e5ec' : isSkeuo ? '#f5f5f5' : isKitchen ? '#fffdf5' : '#ffffff';
        const accent = isGlass ? '#a78bfa' : isNeo ? '#6366f1' : isSkeuo ? '#007aff' : isKitchen ? '#34c759' : '#007aff';
        const textColor = isGlass ? '#fff' : '#000';
        const borderStyle = (isKitchen || isSkeuo) ? { borderWidth: 1, borderColor: isKitchen ? '#cbd5e1' : '#ccc' }
            : isNeo ? { borderWidth: 0 }
            : isGlass ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }
            : { borderWidth: 2, borderColor: '#000' };

        return (
            <SafeAreaProvider>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: themeBg }]}>
                <StatusBar barStyle={isGlass ? 'light-content' : 'dark-content'} backgroundColor={themeBg} />
                <View style={[styles.pairScreen, { backgroundColor: themeBg }]}>
                    <TouchableOpacity style={[styles.themeBadge, activeStyles.themeBadge]} onPress={toggleTheme}>
                        <Text style={[styles.themeBadgeText, isGlass && { color: '#fff' }]}>{themeLabels[theme] || 'MODE'}</Text>
                    </TouchableOpacity>
                    <View style={[styles.card, activeStyles.card, { backgroundColor: cardBg }]}>
                        <Text style={styles.logo}>🫕</Text>
                        <Text style={[styles.title, { color: textColor }]}>KITCHEN BRIDGE</Text>
                        <Text style={[styles.subtitle, { color: isGlass ? 'rgba(255,255,255,0.6)' : '#666' }]}>Cloud Station Link</Text>
                        
                        <View style={[styles.divider, (isKitchen || isSkeuo) && { backgroundColor: '#e2e8f0', height: 1 }, isNeo && { backgroundColor: '#d1d5db', height: 1 }, isGlass && { backgroundColor: 'rgba(255,255,255,0.2)', height: 1 }]} />

                        <Text style={[styles.stepLabel, { color: textColor }]}>1. START THE STOVE</Text>
                        <View style={[styles.codeBlock, { backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : isNeo ? '#e0e5ec' : isSkeuo ? '#f0f0f0' : isKitchen ? '#f1f5f9' : '#ffd60a', ...borderStyle }]}><Text style={[styles.codeText, { color: textColor }]}>soupz-stall → /cloud-kitchen</Text></View>

                        <Text style={[styles.stepLabel, { color: textColor }]}>2. ENTER KITCHEN IP</Text>
                        <View style={styles.hostRow}>
                            <TextInput style={[styles.inputField, { flex: 2, color: textColor, ...borderStyle }]} value={host} onChangeText={setHost} placeholder="192.168.x.x" placeholderTextColor={isGlass ? 'rgba(255,255,255,0.4)' : '#aaa'} autoCapitalize="none" />
                            <Text style={[styles.colon, { color: textColor }]}>:</Text>
                            <TextInput style={[styles.inputField, { flex: 1, color: textColor, ...borderStyle }]} value={port} onChangeText={setPort} placeholder="7533" placeholderTextColor={isGlass ? 'rgba(255,255,255,0.4)' : '#aaa'} keyboardType="number-pad" />
                        </View>

                        <Text style={[styles.stepLabel, { marginTop: 16, color: textColor }]}>3. ENTER ORDER TICKET</Text>
                        <TextInput style={[styles.otpInput, { color: textColor, ...borderStyle }, isSoft && { shadowOpacity: isNeo ? 0 : 0.1, shadowOffset: {width: 0, height: 4}, shadowRadius: isNeo ? 0 : 6 }, isNeo && { backgroundColor: '#e0e5ec', shadowColor: '#b8bec7' }]} value={pairingCode} onChangeText={setPairingCode} placeholder="••••••••" placeholderTextColor={isGlass ? 'rgba(255,255,255,0.3)' : '#ccc'} keyboardType="number-pad" maxLength={8} />

                        <TouchableOpacity style={[styles.primaryBtn, activeStyles.btnPrimary, { backgroundColor: accent }]} onPress={() => { buzz(); pair(); }} disabled={pairing}>
                            <Text style={styles.primaryBtnText}>{pairing ? 'CONNECTING...' : 'LINK STATION'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    const headerBg = isGlass ? '#4a3a6a' : isNeo ? '#e0e5ec' : isSkeuo ? '#eeeeee' : isKitchen ? '#ffffff' : '#ffd60a';
    const bodyBg = isGlass ? '#3a2a5a' : isNeo ? '#e0e5ec' : isSkeuo ? '#e0e0e0' : isKitchen ? '#fcfcfc' : '#f8f9fa';
    const textColor = isGlass ? '#fff' : '#000';
    const borderColor = isGlass ? 'rgba(255,255,255,0.2)' : isNeo ? 'transparent' : isSkeuo ? '#ccc' : isKitchen ? '#cbd5e1' : '#000';
    const softBorder = isSoft ? { borderWidth: isNeo ? 0 : 1, borderColor } : {};

    return (
        <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: bodyBg }]}>
            <StatusBar barStyle={isGlass ? 'light-content' : 'dark-content'} backgroundColor={headerBg} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={[styles.container, { backgroundColor: bodyBg }]}>
                    
                    {/* Header */}
                    <View style={[styles.header, activeStyles.header, { backgroundColor: headerBg }]}>
                        <View>
                            <TouchableOpacity onPress={toggleTheme}><Text style={[styles.headerTitle, { color: textColor }, isKitchen && { letterSpacing: 0, fontWeight: '800' }]}>🫕 {themeLabels[theme] || 'STATION'}</Text></TouchableOpacity>
                            <View style={[styles.statusBadge, isSoft && { borderWidth: 1, borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : isNeo ? '#e0e5ec' : '#f8fafc' }]}>
                                <View style={[styles.statusDot, isSoft && { borderWidth: 0 }, connected ? styles.statusOn : styles.statusOff]} />
                                <Text style={[styles.headerStatus, { color: textColor }]}>{connected ? 'LINK ACTIVE' : 'OFFLINE'}</Text>
                            </View>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => { buzz(); setShowHealth(!showHealth); }} style={[styles.actionBtn, activeStyles.actionBtn]}>
                                <Text style={[styles.actionIcon, { color: textColor }]}>📊</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { buzz(); createTerminal(); }} style={[styles.actionBtn, activeStyles.actionBtn]}>
                                <Text style={[styles.actionIcon, { color: textColor }]}>➕</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { buzz(); disconnect(); }} style={[styles.actionBtn, activeStyles.actionBtn, { backgroundColor: '#ff3b30' }]}>
                                <Text style={[styles.actionIcon, { color: '#fff' }]}>⏻</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Health Panel */}
                    {showHealth && health && (
                        <View style={[styles.healthPanel, isSoft && { borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.08)' : isNeo ? '#e0e5ec' : '#fff' }]}>
                            <Text style={[styles.healthTitle, { color: textColor }]}>SYSTEM HEALTH</Text>
                            <View style={styles.healthRow}>
                                <Text style={[styles.healthLabel, { color: isGlass ? 'rgba(255,255,255,0.7)' : '#666' }]}>CPU</Text>
                                <View style={[styles.progressTrack, isSoft && { borderWidth: 0, backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }]}><View style={[styles.progressFill, { width: `${health.cpu.loadAvg['1m'] * 10}%`, backgroundColor: '#007aff' }]} /></View>
                                <Text style={[styles.healthValue, { color: textColor }]}>{health.cpu.loadAvg['1m'].toFixed(1)}</Text>
                            </View>
                            <View style={styles.healthRow}>
                                <Text style={[styles.healthLabel, { color: isGlass ? 'rgba(255,255,255,0.7)' : '#666' }]}>RAM</Text>
                                <View style={[styles.progressTrack, isSoft && { borderWidth: 0, backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }]}><View style={[styles.progressFill, { width: `${health.memory.usagePercent}%`, backgroundColor: '#ff3b30' }]} /></View>
                                <Text style={[styles.healthValue, { color: textColor }]}>{health.memory.usagePercent}%</Text>
                            </View>
                        </View>
                    )}

                    {/* Tabs */}
                    <View style={[styles.tabContainer, isSoft && { borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.08)' : isNeo ? '#e0e5ec' : '#f8fafc' }]}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {terminals.map(t => (
                                <TouchableOpacity key={t.id} style={[styles.tab, isSoft && { borderRightWidth: 1, borderRightColor: borderColor }, activeTerminal === t.id && (isSoft ? { backgroundColor: isGlass ? 'rgba(52,199,89,0.4)' : '#34c759' } : styles.activeTab)]} onPress={() => { buzz(); setActiveTerminal(t.id); }} onLongPress={() => killTerminal(t.id)}>
                                    <Text style={[styles.tabText, { color: isGlass ? 'rgba(255,255,255,0.7)' : '#666' }, activeTerminal === t.id && (isSoft ? { color: '#fff' } : styles.activeTabText)]}>STOVE {t.id}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Terminal */}
                    {activeTerminal ? (
                        <View style={[styles.terminalWrapper, activeStyles.terminalWrap]}>
                            <ScrollView ref={scrollRef} style={styles.terminal} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
                                <Text style={[styles.terminalText, isKitchen && { color: '#334155' }]} selectable>{outputs[activeTerminal] || 'Awaiting orders...'}</Text>
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>🍳</Text>
                            <Text style={[styles.emptyText, isGlass && { color: 'rgba(255,255,255,0.5)' }]}>STATION IS IDLE</Text>
                            <TouchableOpacity onPress={() => { buzz(); createTerminal(); }} style={[styles.createBtn, activeStyles.btnPrimary, { backgroundColor: isGlass ? '#a78bfa' : isNeo ? '#6366f1' : isKitchen ? '#34c759' : '#ffd60a' }]}>
                                <Text style={[styles.createText, (isKitchen || isGlass || isNeo) && { color: '#fff' }]}>NEW TICKET</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Bars */}
                    {activeTerminal && (
                        <View style={[styles.controlsArea, isSoft && { borderTopWidth: 1, borderTopColor: borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.08)' : isNeo ? '#e0e5ec' : '#f8fafc' }]}>
                            <ScrollView horizontal style={styles.scrollBar} showsHorizontalScrollIndicator={false}>
                                {recipes.map((r, i) => (
                                    <TouchableOpacity key={i} style={[styles.pillBtn, activeStyles.pillBtn]} onPress={() => { buzz(); r.action ? r.action() : sendInput(r.cmd); }}>
                                        <Text style={[styles.pillText, isGlass && { color: '#fff' }]}>{r.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <ScrollView horizontal style={styles.scrollBar} showsHorizontalScrollIndicator={false}>
                                {specialKeys.map((k, i) => (
                                    <TouchableOpacity key={i} style={[styles.pillBtnAlt, isSoft && { borderWidth: 1, borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : '#fff' }]} onPress={() => { buzz(); sendRaw(k.char); }}>
                                        <Text style={[styles.pillTextAlt, isGlass && { color: 'rgba(255,255,255,0.8)' }]}>{k.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={styles.inputArea}>
                                <Text style={[styles.promptSign, isGlass && { color: '#a78bfa' }]}>$</Text>
                                <TextInput style={[styles.mainInput, activeStyles.inputArea, isGlass && { color: '#fff' }]} value={input} onChangeText={handleRawInput} onSubmitEditing={handleRawSubmit} placeholder="Type here..." placeholderTextColor={isGlass ? 'rgba(255,255,255,0.4)' : '#888'} autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} returnKeyType="send" blurOnSubmit={false} />
                                <TouchableOpacity onPress={handleRawSubmit} style={[styles.sendBtn, activeStyles.sendBtn]}>
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

    // DYNAMIC STYLES - BRUTAL
    cardBrutal: { borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 },
    btnPrimaryBrutal: { borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
    headerBrutal: { borderBottomWidth: 3, borderBottomColor: '#000' },
    actionBtnBrutal: { borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
    terminalWrapBrutal: { borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
    pillBtnBrutal: { borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
    inputAreaBrutal: { borderWidth: 2, borderColor: '#000' },
    sendBtnBrutal: { borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
    themeBadgeBrutal: { borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },

    // DYNAMIC STYLES - KITCHEN
    cardKitchen: { borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, borderRadius: 24 },
    btnPrimaryKitchen: { borderWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, borderRadius: 16 },
    headerKitchen: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
    actionBtnKitchen: { borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    terminalWrapKitchen: { borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, borderRadius: 16 },
    pillBtnKitchen: { borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2 },
    inputAreaKitchen: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
    sendBtnKitchen: { borderWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4 },
    themeBadgeKitchen: { borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },

    // DYNAMIC STYLES - SKEUO
    cardSkeuo: { backgroundColor: '#fdfdfd', borderWidth: 1, borderColor: '#fff', shadowColor: '#bebebe', shadowOffset: { width: 10, height: 10 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
    btnPrimarySkeuo: { backgroundColor: '#f0f0f0', shadowColor: '#bebebe', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 5 },
    headerSkeuo: { borderBottomWidth: 1, borderBottomColor: '#ddd', backgroundColor: '#f8fafc' },
    actionBtnSkeuo: { backgroundColor: '#f0f0f0', shadowColor: '#bebebe', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },
    terminalWrapSkeuo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', shadowColor: '#bebebe', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
    pillBtnSkeuo: { backgroundColor: '#fdfdfd', shadowColor: '#bebebe', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },
    inputAreaSkeuo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
    sendBtnSkeuo: { backgroundColor: '#f0f0f0', shadowColor: '#bebebe', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },

    // DYNAMIC STYLES - NEO (Neomorphic)
    cardNeo: { backgroundColor: '#e0e5ec', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, borderRadius: 24 },
    btnPrimaryNeo: { backgroundColor: '#6366f1', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 8, borderRadius: 14 },
    headerNeo: { borderBottomWidth: 0, backgroundColor: '#e0e5ec' },
    actionBtnNeo: { backgroundColor: '#e0e5ec', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 6 },
    terminalWrapNeo: { backgroundColor: '#1a1a2e', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 12, borderRadius: 20 },
    pillBtnNeo: { backgroundColor: '#e0e5ec', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 4, borderRadius: 10 },
    inputAreaNeo: { backgroundColor: '#e0e5ec', borderWidth: 0 },
    sendBtnNeo: { backgroundColor: '#6366f1', borderWidth: 0, shadowColor: '#b8bec7', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 6, borderRadius: 14 },

    // DYNAMIC STYLES - GLASS (Glassmorphic)
    cardGlass: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, borderRadius: 24 },
    btnPrimaryGlass: { backgroundColor: 'rgba(167,139,250,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, borderRadius: 14 },
    headerGlass: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)' },
    actionBtnGlass: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    terminalWrapGlass: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, borderRadius: 20 },
    pillBtnGlass: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderRadius: 10 },
    inputAreaGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    sendBtnGlass: { backgroundColor: 'rgba(167,139,250,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, borderRadius: 14 },

    themeBadge: { position: 'absolute', top: 20, right: 20, zIndex: 100, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    themeBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },

    // Pairing
    pairScreen: { flex: 1, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
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
    pillBtnAlt: { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, minWidth: 44 },
    pillTextAlt: { fontSize: 12, fontWeight: '800', color: '#333', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center' },
    
    inputArea: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    promptSign: { fontSize: 20, fontWeight: '900', color: '#ff3b30' },
    mainInput: { flex: 1, backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: '700', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    sendBtn: { width: 50, height: 50, backgroundColor: '#007aff', borderWidth: 2, borderColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
    sendIcon: { fontSize: 20, color: '#fff', fontWeight: '900' },
});