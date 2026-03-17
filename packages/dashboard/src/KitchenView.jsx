import React, { useState } from 'react';

const stalls = [
  {id:'design-station',name:'Design Station',
   emoji:'🎨',awning:'#7B2D8B',wall:'#3d1545',row:'top'},
  {id:'code-station',name:'Code Station',
   emoji:'💻',awning:'#E86A33',wall:'#5a2800',row:'top'},
  {id:'build-station',name:'Build Station',
   emoji:'🏗️',awning:'#1a5fa8',wall:'#0d2d52',row:'top'},
  {id:'research-station',name:'Research Station',
   emoji:'🔬',awning:'#1a7a3a',wall:'#0a3a1a',row:'bot'},
  {id:'deploy-station',name:'Deploy Station',
   emoji:'🚀',awning:'#444',wall:'#1a1a1a',row:'bot'},
  {id:'order-counter',name:'Order Counter',
   emoji:'🎯',awning:'#c45c00',wall:'#5a2800',
   row:'center'}
];

const PixelChar = ({shirtColor,hatColor,label,animate}) => (
  <div style={{display:'flex',flexDirection:'column',
    alignItems:'center',
    animation:animate?'bob 2s ease-in-out infinite':'none'}}>
    <svg width="32" height="48" viewBox="0 0 32 48">
      <rect x="10" y="0" width="12" height="4" 
        fill={hatColor} rx="1"/>
      <rect x="8" y="4" width="16" height="14" 
        fill="#FDBCB4" rx="2"/>
      <rect x="11" y="8" width="4" height="4" 
        fill="#333" rx="1"/>
      <rect x="17" y="8" width="4" height="4" 
        fill="#333" rx="1"/>
      <rect x="13" y="14" width="6" height="2" 
        fill="#c47c5a"/>
      <rect x="6" y="18" width="20" height="14" 
        fill={shirtColor} rx="1"/>
      <rect x="2" y="18" width="4" height="10" 
        fill={shirtColor}/>
      <rect x="26" y="18" width="4" height="10" 
        fill={shirtColor}/>
      <rect x="8" y="32" width="6" height="10" 
        fill="#555" rx="1"/>
      <rect x="18" y="32" width="6" height="10" 
        fill="#555" rx="1"/>
    </svg>
    <span style={{fontSize:'8px',color:'#FFD700',
      marginTop:'2px',fontWeight:'bold',
      letterSpacing:'1px'}}>{label}</span>
  </div>
);

const Stall = ({id,name,emoji,awning,wall,
                isSelected,onSelect}) => (
  <div onClick={()=>onSelect(id)}
    style={{cursor:'pointer',display:'flex',
      flexDirection:'column',alignItems:'center',
      transition:'transform 0.15s',
      transform:isSelected?'translateY(-4px)':'none'}}>
    <div style={{width:'120px',height:'28px',
      background:awning,borderRadius:'4px 4px 0 0',
      display:'flex',alignItems:'center',
      justifyContent:'center',fontSize:'9px',
      fontWeight:'bold',color:'rgba(255,255,255,0.9)',
      letterSpacing:'1px',position:'relative',
      overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,
        background:'repeating-linear-gradient(90deg,'+
        'rgba(255,255,255,0.12) 0px,'+
        'rgba(255,255,255,0.12) 8px,'+
        'transparent 8px,transparent 16px)'}}/>
      <span style={{position:'relative'}}>
        {emoji} {name.split(' ')[0].toUpperCase()}
      </span>
    </div>
    <div style={{width:'110px',height:'80px',
      background:wall,borderRadius:'0 0 4px 4px',
      border:isSelected?'2px solid #FFD700':
        '1px solid rgba(255,255,255,0.1)',
      boxShadow:isSelected?'0 0 16px rgba(255,215,0,0.4)':'none',
      position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:'8px',
        left:'8px',right:'8px',height:'36px',
        background:'rgba(135,206,235,0.12)',
        border:'1px solid rgba(135,206,235,0.25)',
        borderRadius:'2px',display:'flex',
        alignItems:'center',justifyContent:'center',
        fontSize:'18px'}}>{emoji}</div>
      <div style={{position:'absolute',bottom:0,
        left:0,right:0,height:'20px',
        background:'rgba(0,0,0,0.4)',
        borderTop:'1px solid rgba(255,255,255,0.1)',
        display:'flex',alignItems:'center',
        justifyContent:'center',gap:'4px'}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:'6px',height:'6px',
            borderRadius:'50%',background:awning,
            opacity:0.7}}/>
        ))}
      </div>
    </div>
    <div style={{width:'70px',height:'6px',
      background:'rgba(0,0,0,0.3)',
      borderRadius:'0 0 2px 2px'}}/>
  </div>
);

const StatusPanel = () => (
  <div>
    <div style={{fontSize:'11px',color:'#2FA7A0',
      letterSpacing:'1.5px',marginBottom:'12px',
      paddingBottom:'8px',
      borderBottom:'1px solid #1a1a1a'}}>
      SYSTEM STATUS
    </div>
    <div style={{display:'grid',
      gridTemplateColumns:'1fr 1fr',
      gap:'6px',marginBottom:'14px'}}>
      {[{l:'Machine',v:'Online',c:'#4CAF50'},
        {l:'Agent',v:'Copilot',c:'#eee'},
        {l:'Orders',v:'1',c:'#eee'},
        {l:'Tokens Saved',v:'142',c:'#2FA7A0'}
      ].map(s=>(
        <div key={s.l} style={{background:'#1a1a1a',
          padding:'8px 10px',borderRadius:'3px',
          border:'1px solid #222'}}>
          <div style={{fontSize:'10px',color:'#555',
            marginBottom:'3px'}}>{s.l}</div>
          <div style={{fontSize:'13px',color:s.c,
            fontWeight:'bold'}}>{s.v}</div>
        </div>
      ))}
    </div>
    <div style={{fontSize:'11px',lineHeight:'2',
      color:'#555'}}>
      <div>YOU → type a prompt</div>
      <div style={{color:'#2FA7A0'}}>↓</div>
      <div>ORDER TAKER → routes to chef</div>
      <div style={{color:'#2FA7A0'}}>↓</div>
      <div>CHEF → executes task</div>
      <div style={{color:'#2FA7A0'}}>↓</div>
      <div>RESULT → delivered to you</div>
    </div>
  </div>
);

const BillPanel = ({data}) => (
  <div style={{background:'linear-gradient(#f5e6c8,#e8d5a3)',
    border:'2px solid #8B6914',borderRadius:'6px',
    padding:'14px',color:'#2a1500'}}>
    <div style={{textAlign:'center',fontSize:'13px',
      fontWeight:'bold',borderBottom:'1.5px solid #8B6914',
      paddingBottom:'8px',marginBottom:'10px'}}>
      📜 YOUR ORDER BILL
    </div>
    {[{l:'Agent',v:data?.agent||'Copilot'},
      {l:'Tokens Used',v:data?.tokensUsed||180,
       c:'#c45c00'},
      {l:'Tokens Saved',v:data?.tokensSaved||142,
       c:'#2d6b2d'},
      {l:'Duration',v:(data?.durationMs
        ?Math.round(data.durationMs/1000)+'s':'9s')}
    ].map(r=>(
      <div key={r.l} style={{display:'flex',
        justifyContent:'space-between',fontSize:'11px',
        padding:'3px 0',
        borderBottom:'1px dotted rgba(139,105,20,0.3)'}}>
        <span>{r.l}</span>
        <span style={{fontWeight:'bold',
          color:r.c||'#2a1500'}}>{r.v}</span>
      </div>
    ))}
    <div style={{display:'flex',gap:'6px',
      marginTop:'10px'}}>
      <button style={{flex:1,background:'#4CAF50',
        color:'white',border:'none',padding:'6px',
        fontFamily:'monospace',fontSize:'11px',
        fontWeight:'bold',borderRadius:'3px',
        cursor:'pointer'}}>✓ KEEP</button>
      <button style={{flex:1,background:'#D64545',
        color:'white',border:'none',padding:'6px',
        fontFamily:'monospace',fontSize:'11px',
        fontWeight:'bold',borderRadius:'3px',
        cursor:'pointer'}}>✕ DISCARD</button>
    </div>
  </div>
);

const ActivityFeed = ({orders}) => (
  <div>
    <div style={{fontSize:'11px',color:'#555',
      letterSpacing:'1.5px',marginBottom:'8px',
      textTransform:'uppercase'}}>
      Recent Orders
    </div>
    {orders.map(o=>(
      <div key={o.id} style={{background:'#1a1a1a',
        padding:'8px',borderRadius:'3px',
        border:'1px solid #222',marginBottom:'4px',
        fontSize:'11px'}}>
        <div style={{display:'flex',
          justifyContent:'space-between',
          marginBottom:'2px'}}>
          <span style={{color:'#2FA7A0'}}>{o.id}</span>
          <span style={{color:o.status==='done'?
            '#4CAF50':'#E86A33'}}>
            {o.status==='done'?'✓ done':'⟳ running'}
          </span>
        </div>
        <div style={{color:'#555'}}>
          {o.agent} · "{o.prompt}"
        </div>
      </div>
    ))}
  </div>
);

const KitchenView = () => {
  const [selected,setSelected] = useState('order-counter');
  const [prompt,setPrompt] = useState('');
  const [activePanel,setActivePanel] = useState('status');
  const [orders,setOrders] = useState([
    {id:'#001',agent:'copilot',
     status:'done',prompt:'hello'}
  ]);

  const selectedStall = stalls.find(s=>s.id===selected);
  const topStalls = stalls.filter(s=>s.row==='top');
  const botStalls = stalls.filter(s=>s.row==='bot');

  const handleOrder = () => {
    if(!prompt.trim()) return;
    const newOrder = {
      id:'#00'+(orders.length+1),
      agent:selected.replace('-station','')
        .replace('-counter','orchestrator'),
      status:'running',
      prompt
    };
    setOrders(prev=>[newOrder,...prev]);
    setPrompt('');
    setTimeout(()=>{
      setOrders(prev=>prev.map(o=>
        o.id===newOrder.id?{...o,status:'done'}:o
      ));
      setActivePanel('bill');
    },3000);
  };

  return (
    <div style={{display:'flex',height:'100vh',
      width:'100vw',background:'#0a0a0a',
      fontFamily:'monospace',overflow:'hidden'}}>

      {/* LEFT: Market View */}
      <div style={{width:'62%',display:'flex',
        flexDirection:'column',position:'relative',
        overflow:'hidden'}}>

        {/* Top Bar */}
        <div style={{height:'44px',background:'#0d0d0d',
          borderBottom:'1.5px solid #2FA7A0',
          display:'flex',alignItems:'center',
          padding:'0 16px',justifyContent:'space-between',
          flexShrink:0,zIndex:20}}>
          <div style={{color:'#2FA7A0',fontSize:'15px',
            fontWeight:'bold',letterSpacing:'2px'}}>
            🍜 SOUPZ STALL
          </div>
          <div style={{display:'flex',alignItems:'center',
            gap:'8px',fontSize:'11px',color:'#666'}}>
            <div style={{width:'8px',height:'8px',
              borderRadius:'50%',background:'#4CAF50',
              boxShadow:'0 0 6px #4CAF50'}}/>
            <span style={{color:'#4CAF50'}}>Online</span>
          </div>
        </div>

        {/* Game World */}
        <div style={{flex:1,position:'relative',
          background:'#111008',overflow:'hidden',
          backgroundImage:'repeating-linear-gradient('+
          '0deg,transparent,transparent 31px,'+
          'rgba(255,255,255,0.02) 31px,'+
          'rgba(255,255,255,0.02) 32px),'+
          'repeating-linear-gradient(90deg,'+
          'transparent,transparent 31px,'+
          'rgba(255,255,255,0.02) 31px,'+
          'rgba(255,255,255,0.02) 32px)'}}>

          {/* String Lights */}
          <div style={{position:'absolute',top:'8px',
            left:0,right:0,display:'flex',
            alignItems:'flex-end',
            justifyContent:'center',
            height:'28px',zIndex:5}}>
            {Array.from({length:36}).map((_,i)=>{
              const colors=['#FFD700','#E86A33','#2FA7A0'];
              const c=colors[i%3];
              return (
                <div key={i} style={{display:'flex',
                  flexDirection:'column',
                  alignItems:'center'}}>
                  <div style={{width:'18px',height:'1px',
                    background:'#444'}}/>
                  <div style={{width:'7px',height:'7px',
                    borderRadius:'50%',background:c,
                    boxShadow:`0 0 5px ${c}`,
                    animation:`pulse ${1+i*0.08}s `+
                    'ease-in-out infinite',
                    animationDelay:`${i*0.15}s`}}/>
                </div>
              );
            })}
          </div>

          {/* Top Row Stalls */}
          <div style={{position:'absolute',top:'44px',
            left:0,right:0,display:'flex',
            justifyContent:'space-around',
            padding:'0 20px'}}>
            {topStalls.map(s=>(
              <Stall key={s.id} {...s}
                isSelected={selected===s.id}
                onSelect={setSelected}/>
            ))}
          </div>

          {/* Center: Order Counter */}
          <div style={{position:'absolute',
            top:'50%',left:'50%',
            transform:'translate(-50%,-70%)',
            display:'flex',flexDirection:'column',
            alignItems:'center',zIndex:5}}>
            <div onClick={()=>setSelected('order-counter')}
              style={{cursor:'pointer',display:'flex',
                flexDirection:'column',
                alignItems:'center'}}>
              <div style={{width:'150px',height:'32px',
                background:'#c45c00',
                borderRadius:'4px 4px 0 0',
                display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:'10px',
                fontWeight:'bold',color:'white',
                letterSpacing:'1px',
                position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',inset:0,
                  background:'repeating-linear-gradient('+
                  '90deg,rgba(255,255,255,0.1) 0px,'+
                  'rgba(255,255,255,0.1) 8px,'+
                  'transparent 8px,transparent 16px)'}}/>
                <span style={{position:'relative'}}>
                  🎯 ORDER COUNTER
                </span>
              </div>
              <div style={{width:'140px',height:'70px',
                background:'#5a2800',
                borderRadius:'0 0 4px 4px',
                border:selected==='order-counter'?
                  '2px solid #FFD700':
                  '1px solid rgba(255,255,255,0.1)',
                boxShadow:selected==='order-counter'?
                  '0 0 16px rgba(255,215,0,0.4)':'none',
                position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',
                  top:'6px',left:'8px',right:'8px',
                  height:'36px',
                  background:'rgba(135,206,235,0.1)',
                  border:'1px solid rgba(135,206,235,0.2)',
                  borderRadius:'2px',display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:'20px'}}>📋</div>
                <div style={{position:'absolute',
                  bottom:0,left:0,right:0,height:'20px',
                  background:'rgba(0,0,0,0.5)',
                  borderTop:'1px solid rgba(255,255,255,0.1)',
                  display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:'8px',
                  color:'#E86A33',letterSpacing:'1px'}}>
                  ORCHESTRATOR
                </div>
              </div>
            </div>

            {/* YOU + Benches */}
            <div style={{display:'flex',gap:'12px',
              alignItems:'flex-end',marginTop:'8px'}}>
              <div style={{width:'45px',height:'14px',
                background:'#5D3A1A',borderRadius:'2px',
                position:'relative'}}>
                <div style={{position:'absolute',
                  bottom:'-5px',left:'5px',width:'7px',
                  height:'6px',background:'#4a2e14',
                  borderRadius:'0 0 2px 2px'}}/>
                <div style={{position:'absolute',
                  bottom:'-5px',right:'5px',width:'7px',
                  height:'6px',background:'#4a2e14',
                  borderRadius:'0 0 2px 2px'}}/>
              </div>
              <PixelChar shirtColor="#2FA7A0"
                hatColor="#FFD700" label="YOU"
                animate={true}/>
              <div style={{width:'45px',height:'14px',
                background:'#5D3A1A',borderRadius:'2px',
                position:'relative'}}>
                <div style={{position:'absolute',
                  bottom:'-5px',left:'5px',width:'7px',
                  height:'6px',background:'#4a2e14',
                  borderRadius:'0 0 2px 2px'}}/>
                <div style={{position:'absolute',
                  bottom:'-5px',right:'5px',width:'7px',
                  height:'6px',background:'#4a2e14',
                  borderRadius:'0 0 2px 2px'}}/>
              </div>
            </div>
          </div>

          {/* Bottom Row Stalls */}
          <div style={{position:'absolute',bottom:'56px',
            left:0,right:0,display:'flex',
            justifyContent:'space-around',
            padding:'0 20px'}}>
            {botStalls.map(s=>(
              <Stall key={s.id} {...s}
                isSelected={selected===s.id}
                onSelect={setSelected}/>
            ))}
          </div>

          {/* Arch Sign */}
          <div style={{position:'absolute',bottom:'8px',
            left:'50%',transform:'translateX(-50%)',
            zIndex:3}}>
            <svg width="200" height="36"
              viewBox="0 0 200 36">
              <path d="M10,34 Q100,2 190,34"
                fill="none" stroke="#E86A33"
                strokeWidth="3"
                strokeLinecap="round"/>
              <text x="100" y="26"
                textAnchor="middle" fill="#E86A33"
                fontFamily="monospace" fontSize="9"
                fontWeight="bold" letterSpacing="2">
                SOUPZ STALLS
              </text>
            </svg>
          </div>
        </div>

        {/* Input Bar */}
        <div style={{height:'52px',background:'#0d0d0d',
          borderTop:'1.5px solid #2FA7A0',
          display:'flex',alignItems:'center',
          padding:'0 12px',gap:'10px',
          flexShrink:0,zIndex:10}}>
          <div style={{display:'flex',
            alignItems:'center',gap:'6px',
            whiteSpace:'nowrap',fontSize:'11px',
            fontWeight:'bold',minWidth:'120px'}}>
            <div style={{width:'10px',height:'10px',
              borderRadius:'2px',
              background:selectedStall?.awning||'#E86A33'}}/>
            <span style={{color:selectedStall?.awning||
              '#E86A33'}}>
              → {(selectedStall?.name||
                'Order Counter').toUpperCase()}
            </span>
          </div>
          <input
            value={prompt}
            onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleOrder()}
            placeholder={`Order from ${
              selectedStall?.name||'Order Counter'}...`}
            style={{flex:1,background:'#1a1a1a',
              border:'1px solid #333',borderRadius:'3px',
              padding:'6px 10px',color:'#eee',
              fontFamily:'monospace',fontSize:'12px',
              outline:'none'}}/>
          <button onClick={handleOrder}
            style={{background:'#2FA7A0',color:'#111',
              border:'none',padding:'7px 14px',
              fontFamily:'monospace',fontSize:'12px',
              fontWeight:'bold',cursor:'pointer',
              borderRadius:'3px',whiteSpace:'nowrap'}}>
            ORDER →
          </button>
        </div>
      </div>

      {/* RIGHT: Panels */}
      <div style={{flex:1,display:'flex',
        flexDirection:'column',
        borderLeft:'1.5px solid #1a1a1a',
        overflow:'hidden'}}>

        {/* Top Panel */}
        <div style={{flex:'0 0 62%',
          borderBottom:'1px solid #1a1a1a',
          overflow:'auto',padding:'14px'}}>
          <div style={{display:'flex',gap:'6px',
            marginBottom:'12px'}}>
            {['status','bill','diff'].map(p=>(
              <button key={p}
                onClick={()=>setActivePanel(p)}
                style={{background:activePanel===p?
                  '#2FA7A0':'#1a1a1a',
                  border:activePanel===p?
                  '1px solid #2FA7A0':
                  '1px solid #333',
                  color:activePanel===p?'#111':'#666',
                  padding:'4px 10px',borderRadius:'3px',
                  cursor:'pointer',
                  fontFamily:'monospace',fontSize:'10px',
                  fontWeight:activePanel===p?
                  'bold':'normal',
                  textTransform:'uppercase'}}>
                {p}
              </button>
            ))}
          </div>
          {activePanel==='status' && <StatusPanel/>}
          {activePanel==='bill' && <BillPanel data={null}/>}
          {activePanel==='diff' && (
            <div>
              <div style={{fontSize:'11px',
                color:'#2FA7A0',letterSpacing:'1.5px',
                marginBottom:'12px'}}>
                CODE DIFF VIEW
              </div>
              <div style={{display:'grid',
                gridTemplateColumns:'1fr 1fr',
                gap:'4px',height:'160px'}}>
                <div style={{background:'#1a0000',
                  padding:'8px',borderRadius:'3px',
                  overflow:'auto'}}>
                  <div style={{color:'#ff6b6b',
                    fontSize:'10px',marginBottom:'4px'}}>
                    OLD
                  </div>
                  <pre style={{color:'#ffaaaa',
                    fontSize:'10px',lineHeight:1.6,
                    margin:0}}>
{`function route(p) {
  return 'copilot';
}`}
                  </pre>
                </div>
                <div style={{background:'#001a00',
                  padding:'8px',borderRadius:'3px',
                  overflow:'auto'}}>
                  <div style={{color:'#6bff6b',
                    fontSize:'10px',marginBottom:'4px'}}>
                    NEW
                  </div>
                  <pre style={{color:'#aaffaa',
                    fontSize:'10px',lineHeight:1.6,
                    margin:0}}>
{`function route(p) {
  return semantic
    Router(p).id;
}`}
                  </pre>
                </div>
              </div>
              <div style={{display:'flex',gap:'6px',
                marginTop:'8px'}}>
                <button style={{flex:1,
                  background:'#4CAF50',color:'white',
                  border:'none',padding:'6px',
                  fontFamily:'monospace',fontSize:'10px',
                  fontWeight:'bold',borderRadius:'3px',
                  cursor:'pointer'}}>
                  ✓ KEEP
                </button>
                <button style={{flex:1,
                  background:'#D64545',color:'white',
                  border:'none',padding:'6px',
                  fontFamily:'monospace',fontSize:'10px',
                  fontWeight:'bold',borderRadius:'3px',
                  cursor:'pointer'}}>
                  ✕ DISCARD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Panel */}
        <div style={{flex:1,overflow:'auto',
          padding:'14px'}}>
          <ActivityFeed orders={orders}/>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1} 50%{opacity:0.5}
        }
        @keyframes bob {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-3px)}
        }
        input:focus{border-color:#2FA7A0 !important}
      `}</style>
    </div>
  );
};

export default KitchenView;
