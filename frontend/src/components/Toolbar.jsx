import React, { useState, useEffect, useRef } from 'react';
import { wsManager } from '../wsStore';

export default function Toolbar({ 
    activeAsset, 
    setActiveAsset, 
    globalMinVol, 
    setGlobalMinVol,
    onResetLayout 
}) {
    const [status, setStatus] = useState("OFFLINE");
    const [allSymbols, setAllSymbols] = useState([]);
    const [searchVal, setSearchVal] = useState("");
    const [showResults, setShowResults] = useState(false);
    const [currentFocus, setCurrentFocus] = useState(-1);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);

    useEffect(() => {
        const handleStatus = (st) => setStatus(st);
        const handleSymbols = (syms) => setAllSymbols(syms);

        wsManager.on('connection_status', handleStatus);
        wsManager.on('symbols_list', handleSymbols);

        return () => {
            wsManager.off('connection_status', handleStatus);
            wsManager.off('symbols_list', handleSymbols);
        };
    }, []);

    // Filtered symbols
    const filteredSymbols = searchVal ? allSymbols.filter(s => s.includes(searchVal.toUpperCase())).slice(0, 15) : [];

    const selectAsset = (symbol) => {
        setSearchVal(symbol);
        setShowResults(false);
        handleConnect(symbol);
    };

    const handleConnect = (symbolToConnect = searchVal) => {
        const asset = symbolToConnect.toUpperCase();
        if (!asset) return;
        setActiveAsset(asset);
        
        wsManager.emit('status_clear'); // Local UI clear
        wsManager.subscribeAsset(asset);
        
        // Wait briefly for subscribe before requesting VAP
        setTimeout(() => {
            // Need to know current VAP mins? Let's just request the default 5 for now.
            // The VAP widget can request later if it wants.
            wsManager.requestVAP(5); 
        }, 500);
    };

    const handleDisconnect = () => {
        wsManager.unsubscribeAsset();
        setActiveAsset("");
        wsManager.emit('status_clear');
    };

    const handleKeyDown = (e) => {
        if (!showResults || filteredSymbols.length === 0) return;
        
        if (e.key === "ArrowDown") {
            setCurrentFocus(prev => (prev >= filteredSymbols.length - 1 ? 0 : prev + 1));
        } else if (e.key === "ArrowUp") {
            setCurrentFocus(prev => (prev <= 0 ? filteredSymbols.length - 1 : prev - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const focusedIdx = currentFocus > -1 ? currentFocus : 0;
            if (filteredSymbols[focusedIdx]) {
                selectAsset(filteredSymbols[focusedIdx]);
            }
        }
    };

    // Auto-scroll logic inside results
    useEffect(() => {
        if (currentFocus > -1 && resultsRef.current) {
            const activeItem = resultsRef.current.children[currentFocus];
            if (activeItem) {
                activeItem.scrollIntoView({ block: "nearest" });
            }
        }
    }, [currentFocus]);

    return (
        <div className="toolbar">
            <div className="search-box">
                <input 
                    type="text" 
                    placeholder="Buscar Ativo (ex: WDO)..." 
                    autoComplete="off"
                    value={searchVal}
                    onChange={(e) => {
                        setSearchVal(e.target.value);
                        setCurrentFocus(-1);
                        setShowResults(!!e.target.value);
                    }}
                    onFocus={() => { if (searchVal) setShowResults(true); }}
                    onBlur={() => { setTimeout(() => setShowResults(false), 200); }}
                    onKeyDown={handleKeyDown}
                    ref={inputRef}
                />
                <div 
                    id="search-results" 
                    ref={resultsRef} 
                    style={{ display: showResults && filteredSymbols.length > 0 ? "block" : "none" }}
                >
                    {filteredSymbols.map((s, idx) => (
                        <div 
                            key={s} 
                            className={`search-item ${idx === currentFocus ? 'active' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectAsset(s);
                            }}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            </div>
            
            <button className="btn-green" onClick={() => handleConnect()}>CONECTAR</button>
            <button className="btn-red" onClick={handleDisconnect}>DESCONECTAR</button>
            
            <div style={{ borderLeft: '1px solid var(--border)', height: 20, margin: '0 5px' }}></div>
            
            <label style={{ fontSize: 11, fontWeight: 'bold' }}>IGNORAR LOTES {'<'}</label>
            <input 
                type="number" 
                value={globalMinVol} 
                onChange={(e) => setGlobalMinVol(Number(e.target.value))} 
                style={{ width: 60 }} 
            />
            
            <button className="btn-reset" onClick={onResetLayout} style={{ marginLeft: 20 }} title="Restaura o layout original">
                Resetar Layout
            </button>
            
            <span style={{ fontSize: 11, fontWeight: 'bold', marginLeft: 'auto', color: status === 'WS ONLINE' ? 'var(--green)' : '#888' }}>
                {status}
            </span>
        </div>
    );
}
