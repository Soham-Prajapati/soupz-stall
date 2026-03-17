import React, { useState } from 'react';

const PixelChar = ({ shirtColor, hatColor, skinColor, label, selected, onClick, animate = true }) => {
  return (
    <div 
      onClick={onClick}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: animate ? 'bob 1.5s ease-in-out infinite' : 'none',
        position: 'relative'
      }}
    >
      <svg width="48" height="72" viewBox="0 0 48 72">
        <style>
          {`@keyframes bob { 
            0%,100%{transform:translateY(0)} 
            50%{transform:translateY(-3px)} 
          }`}
        </style>
        {selected && (
          <rect x="-3" y="-3" width="54" height="78" fill="none" stroke="#FFD700" strokeWidth="3" />
        )}
        {/* Hat */}
        <rect x="6" y="0" width="36" height="9" fill={hatColor} />
        {/* Head */}
        <rect x="9" y="9" width="30" height="24" fill={skinColor} />
        {/* Eyes */}
        <rect x="12" y="15" width="6" height="6" fill="#222" />
        <rect x="30" y="15" width="6" height="6" fill="#222" />
        {/* Mouth */}
        <rect x="18" y="27" width="12" height="3" fill="#c47c5a" />
        {/* Body */}
        <rect x="6" y="33" width="36" height="24" fill={shirtColor} />
        {/* Arms */}
        <rect x="0" y="33" width="6" height="18" fill={shirtColor} />
        <rect x="42" y="33" width="6" height="18" fill={shirtColor} />
        {/* Legs */}
        <rect x="9" y="57" width="12" height="15" fill="#555" />
        <rect x="27" y="57" width="12" height="15" fill="#555" />
      </svg>
      <span style={{ 
        color: 'white', 
        fontSize: '10px', 
        fontFamily: 'monospace', 
        marginTop: '4px',
        textShadow: '1px 1px 2px black'
      }}>
        {label}
      </span>
    </div>
  );
};

const Stall = ({ id, name, emoji, roofColor, wallColor, isSelected, onSelect }) => {
  const darkerRoof = (color) => {
    // Simple mock for darkening
    return color === '#7B2D8B' ? '#5a1f6e' : 
           color === '#1a5fa8' ? '#163d6b' :
           color === '#c45c00' ? '#8B3a00' :
           color === '#1a7a3a' ? '#0f4a22' : '#074040';
  };

  return (
    <div 
      onClick={() => onSelect(id)}
      style={{ 
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      <svg width="180" height="200" viewBox="0 0 180 200">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {isSelected && (
          <rect x="-4" y="-4" width="188" height="208" fill="none" stroke="#FFD700" strokeWidth="4" filter="url(#glow)" />
        )}

        {/* Roof */}
        <rect x="0" y="0" width="180" height="60" fill={roofColor} />
        <rect x="0" y="10" width="180" height="4" fill="rgba(0,0,0,0.2)" />
        <rect x="0" y="25" width="180" height="4" fill="rgba(0,0,0,0.2)" />
        <rect x="0" y="40" width="180" height="4" fill="rgba(0,0,0,0.2)" />
        
        {/* Roof overhang shadow */}
        <rect x="0" y="55" width="180" height="10" fill="rgba(0,0,0,0.4)" />

        {/* Front wall */}
        <rect x="0" y="65" width="180" height="100" fill={wallColor} />

        {/* Door */}
        <rect x="72" y="120" width="36" height="45" fill="#4a2800" />
        <rect x="76" y="124" width="12" height="20" fill="#8B4513" />
        <rect x="92" y="124" width="12" height="20" fill="#8B4513" />

        {/* Windows */}
        {/* Left */}
        <rect x="15" y="80" width="40" height="35" fill="#87CEEB" />
        <line x1="15" y1="97.5" x2="55" y2="97.5" stroke="#333" strokeWidth="1" />
        <line x1="35" y1="80" x2="35" y2="115" stroke="#333" strokeWidth="1" />
        {/* Right */}
        <rect x="125" y="80" width="40" height="35" fill="#87CEEB" />
        <line x1="125" y1="97.5" x2="165" y2="97.5" stroke="#333" strokeWidth="1" />
        <line x1="145" y1="80" x2="145" y2="115" stroke="#333" strokeWidth="1" />

        {/* Sign */}
        <rect x="45" y="68" width="90" height="20" fill="#2a1500" />
        <text x="90" y="82" fill="white" fontSize="9" fontFamily="monospace" textAnchor="middle">
          {emoji} {name}
        </text>

        {/* Steps */}
        <rect x="60" y="163" width="60" height="8" fill="rgba(0,0,0,0.3)" />
        <rect x="66" y="171" width="48" height="7" fill="rgba(0,0,0,0.5)" />
      </svg>
    </div>
  );
};

const Tree = () => (
  <div style={{ position: 'relative' }}>
    <svg width="40" height="60" viewBox="0 0 40 60">
      <rect x="16" y="40" width="8" height="12" fill="#8B4513" />
      <circle cx="20" cy="25" r="16" fill="#2d7a1b" />
    </svg>
  </div>
);

const KitchenView = () => {
  const [selected, setSelected] = useState('order-counter');
  const [prompt, setPrompt] = useState('');

  const stalls = [
    { id:'design-station', name:'Design Station', emoji:'🎨', roofColor:'#7B2D8B', wallColor:'#5a1f6e', x:80, y:60 },
    { id:'build-station', name:'Build Station', emoji:'🏗️', roofColor:'#1a5fa8', wallColor:'#163d6b', x:500, y:60 },
    { id:'order-counter', name:'Order Counter', emoji:'🎯', roofColor:'#c45c00', wallColor:'#8B3a00', x:280, y:260 },
    { id:'research-station', name:'Research Station', emoji:'🔬', roofColor:'#1a7a3a', wallColor:'#0f4a22', x:80, y:460 },
    { id:'content-station', name:'Content Station', emoji:'✍️', roofColor:'#0e6b6b', wallColor:'#074040', x:500, y:460 }
  ];

  const selectedStall = stalls.find(s => s.id === selected);

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#111',
      overflow: 'hidden',
      fontFamily: 'monospace'
    }}>
      {/* Top Bar */}
      <div style={{ 
        height: '48px', 
        background: '#111', 
        borderBottom: '2px solid #2FA7A0', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 20px',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <h1 style={{ color: '#2FA7A0', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>🍜 SOUPZ STALL</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50' }}></div>
          <span style={{ color: '#aaa', fontSize: '12px' }}>Online</span>
        </div>
      </div>

      {/* Game World */}
      <div style={{ 
        flexGrow: 1, 
        position: 'relative', 
        background: '#2d5a1b',
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 5px)',
        overflow: 'hidden'
      }}>
        {/* Environment Scaling Wrapper */}
        <div style={{
          width: '800px',
          height: '700px',
          margin: '0 auto',
          position: 'relative',
          transform: 'scale(1)', // Would change in responsive logic
          transformOrigin: 'top center'
        }}>
          {/* Path */}
          <div style={{ position: 'absolute', top: '100px', left: '160px', width: '480px', height: '500px', background: '#c4a35a', zIndex: 0 }}></div>
          <div style={{ position: 'absolute', top: '300px', left: '100px', width: '600px', height: '100px', background: '#c4a35a', zIndex: 0 }}></div>

          {/* Trees */}
          <div style={{ position: 'absolute', top: '20px', left: '20px' }}><Tree /></div>
          <div style={{ position: 'absolute', top: '20px', right: '20px' }}><Tree /></div>
          <div style={{ position: 'absolute', bottom: '20px', left: '20px' }}><Tree /></div>
          <div style={{ position: 'absolute', bottom: '20px', right: '20px' }}><Tree /></div>
          <div style={{ position: 'absolute', top: '300px', left: '10px' }}><Tree /></div>
          <div style={{ position: 'absolute', top: '300px', right: '10px' }}><Tree /></div>

          {/* Stalls */}
          {stalls.map(stall => (
            <div key={stall.id} style={{ position: 'absolute', top: stall.y, left: stall.x, zIndex: 1 }}>
              <Stall 
                {...stall} 
                isSelected={selected === stall.id} 
                onSelect={setSelected} 
              />
              {stall.id === 'order-counter' && (
                <div style={{ position: 'absolute', top: '160px', left: '66px', zIndex: 2 }}>
                  <PixelChar 
                    label="ORCHESTRATOR" 
                    shirtColor="#A855F7" 
                    hatColor="#6C63FF" 
                    skinColor="#ffe0bd" 
                  />
                </div>
              )}
            </div>
          ))}

          {/* YOU character */}
          <div style={{ position: 'absolute', top: '350px', left: '376px', zIndex: 2 }}>
            <PixelChar 
              label="YOU" 
              shirtColor="#2FA7A0" 
              hatColor="#FFD700" 
              skinColor="#ffe0bd" 
              animate={true}
            />
          </div>
        </div>
      </div>

      {/* Bottom Input Bar */}
      <div style={{ 
        height: '64px', 
        background: '#111', 
        borderTop: '2px solid #2FA7A0', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 20px',
        gap: '15px',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', background: selectedStall?.roofColor || '#333' }}></div>
          <span style={{ color: selectedStall?.roofColor || '#eee', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
            → {selectedStall?.name.toUpperCase()}
          </span>
        </div>
        
        <input 
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`What would you like to order from ${selectedStall?.name}?`}
          style={{
            flexGrow: 1,
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '8px 12px',
            color: 'white',
            fontFamily: 'monospace',
            outline: 'none'
          }}
        />

        <button style={{
          background: '#2FA7A0',
          color: '#111',
          border: 'none',
          padding: '8px 16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          ORDER →
        </button>
      </div>

      <style>
        {`
          @media (max-width: 800px) {
            div[style*="width: 800px"] {
              transform: scale(0.6) !important;
            }
          }
          @media (min-width: 801px) and (max-width: 1024px) {
            div[style*="width: 800px"] {
              transform: scale(0.8) !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default KitchenView;
