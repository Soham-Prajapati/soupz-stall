import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap,
  Clock,
  TrendingUp,
  DollarSign,
  Activity,
  Cpu,
  Layers,
  Terminal,
  Trophy,
  Sun,
  Moon,
  ChefHat,
  Timer,
  LayoutGrid
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const BentoCard = ({ children, className = "", delay = 0, theme = 'kitchen' }) => {
  const bgClass = theme === 'kitchen' ? "bg-white" : "bg-white";
  const borderClass = "border-[3px] border-black";
  const shadowClass = "shadow-[6px_6px_0px_#000000] hover:shadow-[10px_10px_0px_#000000]";
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 100 }}
      className={`rounded-[2rem] p-8 relative overflow-hidden transition-all duration-300 ${borderClass} ${shadowClass} hover:-translate-y-1 hover:-translate-x-1 ${bgClass} ${className}`}
    >
      {children}
    </motion.div>
  );
};

const StatGroup = ({ label, value, desc, icon: Icon, colorClass }) => (
  <div className="flex flex-col h-full justify-between">
    <div className="flex justify-between items-start">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">{label}</span>
        <div className="text-5xl font-black font-mono tracking-tighter text-black">{value}</div>
      </div>
      <div className={`p-4 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_#000] ${colorClass} text-black`}>
        <Icon size={24} strokeWidth={3} />
      </div>
    </div>
    <div className="text-[10px] font-black text-black/50 mt-6 uppercase tracking-widest bg-black/5 px-3 py-1 rounded-full w-fit">{desc}</div>
  </div>
);

export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState('kitchen'); // 'kitchen' or 'brutal'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const paths = ['/stall-state.json', './stall-state.json', '/public/stall-state.json'];
        let success = false;
        for (const p of paths) {
          try {
            const res = await fetch(`${p}?t=${Date.now()}`);
            if (res.ok) {
              const json = await res.json();
              setData(json);
              setHistory(prev => {
                const newEntry = { time: new Date().toLocaleTimeString().slice(-8), tokens: json.tokens?.total || 0 };
                return [...prev, newEntry].slice(-30);
              });
              success = true;
              break;
            }
          } catch (e) { }
        }
      } catch (err) { }
    };
    const interval = setInterval(fetchData, 2000);
    fetchData();
    return () => clearInterval(interval);
  }, []);

  if (!data) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-black font-black tracking-widest uppercase">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="text-8xl mb-8 drop-shadow-[6px_6px_0px_#000]"
      >
        🫕
      </motion.div>
      <div className="text-2xl tracking-tighter">Pre-heating Kitchen...</div>
      <div className="mt-4 text-[10px] opacity-40">Connecting to Remote Stove</div>
    </div>
  );

  const successRate = data.stats.totalOrders > 0 
    ? Math.round((data.stats.completedOrders / data.stats.totalOrders) * 100) 
    : 0;

  const toggleTheme = () => setTheme(prev => prev === 'kitchen' ? 'brutal' : 'kitchen');

  return (
    <div className={`min-h-screen p-8 lg:p-12 font-sans selection:bg-red-500/30 transition-colors duration-500 ${theme === 'kitchen' ? 'bg-white' : 'bg-[#fcfcfc]'}`}>
      
      {/* ─── KITCHEN TILES BACKGROUND ────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05]" 
           style={{ 
             backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)', 
             backgroundSize: theme === 'kitchen' ? '60px 60px' : '40px 40px' 
           }}>
      </div>

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16 px-4 relative z-10 max-w-[1600px] mx-auto w-full">
        <div className="flex items-center gap-8">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="text-8xl drop-shadow-[6px_6px_0px_#000] cursor-pointer"
          >
            🫕
          </motion.div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-6xl font-black tracking-tighter uppercase leading-none text-black">{data.stall.name}</h1>
              <button 
                onClick={toggleTheme}
                className="ml-6 flex items-center gap-2 px-5 py-2 border-[3px] border-black rounded-2xl bg-white shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-xs font-black uppercase tracking-widest"
              >
                {theme === 'kitchen' ? <Sun size={14} /> : <LayoutGrid size={14} />}
                {theme === 'kitchen' ? 'Well-Lit' : 'Brutal'}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-black uppercase tracking-widest bg-white border-[3px] border-black shadow-[4px_4px_0px_#000] px-4 py-2 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-[#34c759] border-2 border-black animate-pulse" />
                STOVE ACTIVE
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-black/50 uppercase tracking-widest bg-white border-[3px] border-black/10 px-4 py-2 rounded-full">
                <Clock size={12} />
                {Math.floor(data.stall.uptime / 60000)}m Uptime
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
           <div className="text-[10px] font-black text-black/40 uppercase tracking-[0.4em]">Hardware Health</div>
           <div className="flex gap-4">
              <div className="bg-white border-[3px] border-black p-3 rounded-2xl shadow-[4px_4px_0px_#000] flex items-center gap-3">
                 <Cpu size={16} className="text-[#007aff]" />
                 <span className="font-mono font-black text-lg">{data.stall.health?.cpu || 0}%</span>
              </div>
              <div className="bg-white border-[3px] border-black p-3 rounded-2xl shadow-[4px_4px_0px_#000] flex items-center gap-3">
                 <Layers size={16} className="text-[#ff3b30]" />
                 <span className="font-mono font-black text-lg">{data.stall.health?.ram || 0}%</span>
              </div>
           </div>
        </div>
      </header>

      {/* ─── MAIN BENTO GRID ──────────────────────────────────────────────── */}
      <main className="grid grid-cols-12 gap-8 max-w-[1600px] mx-auto relative z-10">
        
        {/* ROW 1: CORE STATS */}
        <BentoCard className="col-span-12 sm:col-span-6 lg:col-span-3" theme={theme}>
          <StatGroup label="Session Orders" value={data.stats.totalOrders} desc="Total session throughput" icon={Zap} colorClass="bg-[#ffd60a]" />
        </BentoCard>

        <BentoCard className="col-span-12 sm:col-span-6 lg:col-span-3" theme={theme}>
          <StatGroup label="Success Rate" value={`${successRate}%`} desc="Percentage served" icon={TrendingUp} colorClass="bg-[#34c759]" />
        </BentoCard>

        <BentoCard className="col-span-12 sm:col-span-6 lg:col-span-3" theme={theme}>
          <StatGroup label="Stove Speed" value={`${data.stats.avgCookTime ? (data.stats.avgCookTime / 1000).toFixed(1) : 0}s`} desc="Avg Latency" icon={Timer} colorClass="bg-[#007aff] !text-white" />
        </BentoCard>

        <BentoCard className="col-span-12 sm:col-span-6 lg:col-span-3" theme={theme}>
          <StatGroup label="Pantry Bill" value={`$${(data.tokens?.cost || 0).toFixed(3)}`} desc="Token Expenditure" icon={DollarSign} colorClass="bg-[#ff3b30] !text-white" />
        </BentoCard>

        {/* ROW 2: KITCHEN FLOOR */}
        <BentoCard className="col-span-12 lg:col-span-8 h-[360px]" theme={theme}>
          <div className="absolute top-8 left-8 text-[10px] font-black text-black/30 tracking-[0.4em] uppercase">Kitchen Floor Activity</div>
          
          <div className="flex items-center h-full pt-8 px-8">
            {/* Door */}
            <div className="hidden sm:block w-32 h-48 border-[4px] border-black rounded-t-[3rem] relative perspective-1000 bg-white shrink-0 shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
              <motion.div 
                animate={data.stall.status === 'cooking' ? { rotateY: -115 } : { rotateY: 0 }}
                transition={{ duration: 0.8, type: "spring" }}
                className="w-full h-full bg-[#ff3b30] border-r-[4px] border-black origin-left flex items-center justify-center rounded-t-[2.8rem] relative z-10"
              >
                <span className="text-[10px] font-black text-white -rotate-90 tracking-[0.5em] uppercase">Kitchen</span>
              </motion.div>
            </div>

            {/* Chefs */}
            <div className="flex gap-12 items-end overflow-x-auto no-scrollbar flex-1 pl-12 py-6">
              <AnimatePresence mode="popLayout">
                {data.chefs.filter(c => c.calls > 0).map((chef) => (
                  <motion.div 
                    key={chef.id} layout
                    initial={{ opacity: 0, scale: 0.8, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex flex-col items-center gap-6 shrink-0 group relative"
                  >
                    <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-black px-4 py-2 rounded-xl whitespace-nowrap pointer-events-none uppercase border-2 border-white shadow-[4px_4px_0px_#000]">
                      {chef.capabilities?.[0] || 'Executive Chef'}
                    </div>
                    <motion.div 
                      animate={data.activeOrders.some(o => (o.persona || o.agent) === chef.id) ? { y: [0, -20, 0], scale: 1.15 } : {}}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className={`text-7xl transition-all duration-300 ${data.activeOrders.some(o => (o.persona || o.agent) === chef.id) ? 'drop-shadow-[8px_8px_0px_#000]' : 'grayscale opacity-30 hover:grayscale-0 hover:opacity-100 hover:scale-110 hover:drop-shadow-[6px_6px_0px_#000]'}`}
                    >
                      {chef.icon}
                    </motion.div>
                    <div className={`text-[10px] font-black px-5 py-2 border-[3px] border-black rounded-full uppercase tracking-widest shadow-[4px_4px_0px_#000] transition-all ${data.activeOrders.some(o => (o.persona || o.agent) === chef.id) ? 'bg-[#ffd60a] text-black' : 'bg-white text-black/40 group-hover:bg-black group-hover:text-white group-hover:shadow-none group-hover:translate-x-1 group-hover:translate-y-1'}`}>
                      @{chef.name.split(' ')[0]}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.chefs.filter(c => c.calls > 0).length === 0 && (
                <div className="flex flex-col items-center justify-center w-full gap-4 text-black/10">
                   <ChefHat size={64} />
                   <div className="text-[10px] font-black uppercase tracking-[0.5em]">Stove is Pre-heating</div>
                </div>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Elite Report Cards */}
        <BentoCard className="col-span-12 lg:col-span-4 h-[360px] bg-[#ffd60a]" theme={theme}>
          <div className="flex justify-between items-center mb-6">
             <span className="text-[10px] font-black text-black tracking-[0.3em] uppercase">Elite Chefs</span>
             <Trophy size={20} />
          </div>
          <div className="space-y-4 overflow-y-auto no-scrollbar h-[260px] pr-2">
            {Object.entries(data.grades)
              .filter(([,v]) => v.usage > 0)
              .sort((a,b) => b[1].grade - a[1].grade)
              .slice(0, 6)
              .map(([id, chef], i) => (
                <div key={id} className="flex items-center gap-4 bg-white border-[3px] border-black p-4 rounded-2xl shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] transition-all">
                  <div className="text-xl font-black text-black/20 w-8 italic">#{i+1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2 text-xs font-black uppercase tracking-tight text-black">
                      <span>{chef.icon} {chef.name.split(' ')[0]}</span>
                      <span className="bg-black text-white px-2 py-0.5 rounded-lg text-[10px]">{Math.round(chef.grade)}</span>
                    </div>
                    <div className="w-full h-3 bg-black/5 border-2 border-black rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${chef.grade}%` }} className="h-full bg-[#34c759] border-r-2 border-black" />
                    </div>
                  </div>
                </div>
              ))}
              {Object.entries(data.grades).filter(([,v]) => v.usage > 0).length === 0 && (
                <div className="h-full flex items-center justify-center text-[10px] font-black text-black/20 uppercase tracking-widest text-center border-4 border-dashed border-black/10 rounded-3xl">No Data Yet</div>
              )}
          </div>
        </BentoCard>

        {/* ROW 3: FLOW CHART */}
        <BentoCard className="col-span-12 lg:col-span-7 h-[420px]" theme={theme}>
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
               <Activity className="text-[#ff3b30]" />
               <span className="text-[10px] font-black text-black tracking-[0.3em] uppercase">Ingredient Throughput</span>
            </div>
            <div className="text-[10px] font-black text-black uppercase bg-[#ffd60a] border-[3px] border-black px-4 py-1.5 rounded-full shadow-[4px_4px_0px_#000]">Live Tokens/Sec</div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ff3b30" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="#000" strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="time" stroke="#000" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} dy={15} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #000', borderRadius: '20px', boxShadow: '6px 6px 0px #000', fontWeight: '900', textTransform: 'uppercase' }} itemStyle={{ color: '#ff3b30' }} />
                <Area type="monotone" dataKey="tokens" stroke="#000" fillOpacity={1} fill="url(#colorTokens)" strokeWidth={5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Order Pad (Receipts) */}
        <BentoCard className="col-span-12 lg:col-span-5 h-[420px]" theme={theme}>
           <div className="flex justify-between items-center mb-8">
              <span className="text-[10px] font-black text-black tracking-[0.3em] uppercase">Order Pad</span>
              <div className="text-[10px] font-black text-white bg-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-[4px_4px_0px_#ffd60a]">Live Stream</div>
           </div>
           <div className="space-y-4 h-[300px] overflow-y-auto no-scrollbar">
            {data.orders?.slice(0, 8).map((o, i) => (
              <motion.div 
                key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 bg-black/[0.03] border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] transition-all"
              >
                <div className={`w-3.5 h-3.5 rounded-full border-[2px] border-black shrink-0 ${o.status === 'served' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`} />
                <div className="text-[9px] font-black text-black bg-white border-2 border-black px-3 py-1.5 rounded-lg uppercase truncate w-24 text-center">@{o.persona || o.agent}</div>
                <div className="flex-1 text-[11px] font-black text-black/80 truncate font-mono tracking-tight">{o.prompt}</div>
                <div className="text-[10px] font-black font-mono text-black border-l-2 border-black pl-3">{o.duration ? (o.duration/1000).toFixed(1)+'s' : '...'}</div>
              </motion.div>
            ))}
            {(!data.orders || data.orders.length === 0) && (
              <div className="h-full flex flex-col items-center justify-center gap-6 border-[4px] border-dashed border-black/10 rounded-[2rem]">
                <ChefHat size={48} className="text-black/10" />
                <div className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em]">Waiting for first order</div>
              </div>
            )}
           </div>
        </BentoCard>

      </main>

      <footer className="mt-24 py-12 border-t-[4px] border-black flex flex-col items-center gap-8 max-w-[1600px] mx-auto w-full opacity-40 hover:opacity-100 transition-all duration-300">
        <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black tracking-[0.3em] uppercase text-black">
          <span className="flex items-center gap-3 px-6 py-3 border-[3px] border-black rounded-2xl bg-white shadow-[4px_4px_0px_#000]"><LayoutGrid size={16} /> Neo-Brutalism</span>
          <span className="flex items-center gap-3 px-6 py-3 border-[3px] border-black rounded-2xl bg-white shadow-[4px_4px_0px_#000]"><ChefHat size={16} /> Well-Lit Kitchen</span>
          <span className="flex items-center gap-3 px-6 py-3 border-[3px] border-black rounded-2xl bg-white shadow-[4px_4px_0px_#000]"><Terminal size={16} /> Remote Stove</span>
        </div>
        <div className="text-[10px] font-black tracking-[1em] text-black bg-[#ffd60a] px-10 py-4 border-[3px] border-black shadow-[6px_6px_0px_#000] mt-4 uppercase">
           Soupz Cloud Kitchen
        </div>
      </footer>
    </div>
  );
}
