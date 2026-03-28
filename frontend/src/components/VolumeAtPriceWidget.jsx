import React, { useEffect, useRef, useState, useCallback } from 'react';
import { wsManager } from '../wsStore';

export default function VolumeAtPriceWidget({ activeAsset }) {
    const [vapMode, setVapMode] = useState('rolling');
    const [vapRange, setVapRange] = useState(5);
    const [hideNeutral, setHideNeutral] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    
    // UI state to drive render (updated every 400ms to save performance)
    const [renderData, setRenderData] = useState([]);
    const [maxVapVolData, setMaxVapVolData] = useState(0);

    // Mutable state references
    const modeRef = useRef('rolling');
    const rangeRef = useRef(5);
    const hideNeutralRef = useRef(true);
    
    const vapDataRef = useRef({});
    const vapTradesRef = useRef([]);
    const vapQueueRef = useRef([]);
    const isVapLoadingRef = useRef(false);
    const maxVapVolRef = useRef(0);
    const vapWindowMsRef = useRef(5 * 60000);

    useEffect(() => {
        modeRef.current = vapMode;
        rangeRef.current = vapRange;
        hideNeutralRef.current = hideNeutral;
        vapWindowMsRef.current = vapRange * 60000;
    }, [vapMode, vapRange, hideNeutral]);

    const addTickToVap = useCallback((t) => {
        if (t.side === 'N' && hideNeutralRef.current) return;
        
        if (!vapDataRef.current[t.p]) {
            vapDataRef.current[t.p] = { b: 0, s: 0, n: 0, t: 0 };
        }
        
        let data = vapDataRef.current[t.p];
        if (t.side === 'B') data.b += t.v;
        else if (t.side === 'S') data.s += t.v;
        else data.n += t.v;
        
        data.t += t.v;
        
        if (data.t > maxVapVolRef.current) {
            maxVapVolRef.current = data.t;
        }
    }, []);

    const rebuildVapData = useCallback(() => {
        vapDataRef.current = {};
        maxVapVolRef.current = 0;
        vapTradesRef.current.forEach(t => addTickToVap(t));
    }, [addTickToVap]);

    useEffect(() => {
        rebuildVapData();
    }, [hideNeutral, rebuildVapData]);

    const handleRequestVap = () => {
        if (!activeAsset) return;
        isVapLoadingRef.current = true;
        setIsLoading(true);
        vapQueueRef.current = [];
        vapTradesRef.current = [];
        wsManager.requestVAP(rangeRef.current);
    };

    useEffect(() => {
        const handleTick = (t) => {
            if (isVapLoadingRef.current) {
                vapQueueRef.current.push(t);
            } else {
                const mode = modeRef.current;
                if (mode === 'fixed') {
                    const cutoffMs = Math.floor(t.ms / vapWindowMsRef.current) * vapWindowMsRef.current;
                    if (vapTradesRef.current.length > 0 && vapTradesRef.current[0].ms < cutoffMs) {
                        vapTradesRef.current = [];
                        vapDataRef.current = {};
                        maxVapVolRef.current = 0;
                    }
                }
                vapTradesRef.current.push(t);
                addTickToVap(t);
            }
        };

        const handleVapSnapshot = (ticks) => {
            let lastMs = 0;
            if (ticks.length > 0) lastMs = ticks[ticks.length - 1].ms;
            
            const merged = ticks.concat(vapQueueRef.current.filter(t => t.ms > lastMs));
            const mode = modeRef.current;
            const latestMarketMs = merged.length > 0 ? merged[merged.length - 1].ms : Date.now();
            let cutoffMs = mode === 'rolling' 
                ? latestMarketMs - vapWindowMsRef.current 
                : Math.floor(latestMarketMs / vapWindowMsRef.current) * vapWindowMsRef.current;
            
            vapTradesRef.current = merged.filter(t => t.ms >= cutoffMs);
            rebuildVapData();
            
            isVapLoadingRef.current = false;
            setIsLoading(false);
            vapQueueRef.current = [];
        };

        const handleClear = () => {
            vapDataRef.current = {};
            vapTradesRef.current = [];
            maxVapVolRef.current = 0;
            vapQueueRef.current = [];
            setRenderData([]);
        };

        const handleInactivity = () => {
            if (activeAsset) {
                console.log("[VAP] Inactivity detected. Requesting VAP snapshot...");
                handleRequestVap();
            }
        };

        wsManager.on('tick', handleTick);
        wsManager.on('vap_snapshot', handleVapSnapshot);
        wsManager.on('status_clear', handleClear);
        wsManager.on('inactivity', handleInactivity);

        return () => {
            wsManager.off('tick', handleTick);
            wsManager.off('vap_snapshot', handleVapSnapshot);
            wsManager.off('status_clear', handleClear);
            wsManager.off('inactivity', handleInactivity);
        };
    }, [addTickToVap, rebuildVapData, activeAsset]);

    // Interval to expire old VAP trades
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isVapLoadingRef.current || vapTradesRef.current.length === 0) return;
            
            const mode = modeRef.current;
            const latestMarketMs = vapTradesRef.current[vapTradesRef.current.length - 1].ms;
            let cutoffMs = mode === 'rolling' 
                ? latestMarketMs - vapWindowMsRef.current 
                : Math.floor(latestMarketMs / vapWindowMsRef.current) * vapWindowMsRef.current;
            
            let expiredCount = 0;
            while(expiredCount < vapTradesRef.current.length && vapTradesRef.current[expiredCount].ms < cutoffMs) {
                expiredCount++;
            }
            
            if (expiredCount > 0) {
                vapTradesRef.current.splice(0, expiredCount);
                rebuildVapData();
            }
        }, 5000);
        
        return () => clearInterval(intervalId);
    }, [rebuildVapData]);

    // Interval to render VAP DOM smoothly without killing React performance
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isVapLoadingRef.current || !activeAsset || Object.keys(vapDataRef.current).length === 0) return;
            
            const prices = Object.keys(vapDataRef.current).map(Number).sort((a,b) => b - a);
            const viewData = prices.map(p => ({
                p,
                ...vapDataRef.current[p]
            }));
            
            setRenderData(viewData);
            setMaxVapVolData(maxVapVolRef.current);
        }, 400);

        return () => clearInterval(intervalId);
    }, [activeAsset]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="drag-handle" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    VOLUME AT PRICE
                    <div style={{ display: 'flex', gap: 5 }}>
                        <select 
                            value={vapMode} 
                            onChange={(e) => {
                                setVapMode(e.target.value);
                                // The original handles RequestVap on mode/style change
                                setTimeout(handleRequestVap, 10);
                            }} 
                            style={{ padding: 2 }}
                        >
                            <option value="rolling">Deslizante</option>
                            <option value="fixed">Bloco Fixo</option>
                        </select>
                        <select 
                            value={vapRange} 
                            onChange={(e) => {
                                setVapRange(Number(e.target.value));
                                setTimeout(handleRequestVap, 10);
                            }} 
                            style={{ padding: 2 }}
                        >
                            <option value="1">1 Min</option>
                            <option value="5">5 Min</option>
                            <option value="15">15 Min</option>
                            <option value="30">30 Min</option>
                            <option value="60">60 Min</option>
                        </select>
                    </div>
                </div>
                <label style={{ fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#888', fontWeight: 'normal' }}>
                    <input 
                        type="checkbox" 
                        checked={hideNeutral} 
                        onChange={(e) => setHideNeutral(e.target.checked)} 
                    />
                    Ocultar Diretos/Leilão
                </label>
            </div>
            
            <div className="content" id="vap-container">
                {isLoading ? (
                    <div style={{ padding: 15, textAlign: 'center' }}>A carregar Histórico VAP...</div>
                ) : (
                    renderData.map((data) => {
                        const buyPct = (data.b / maxVapVolData) * 100;
                        const sellPct = (data.s / maxVapVolData) * 100;
                        const neutralPct = (data.n / maxVapVolData) * 100;
                        
                        return (
                            <div className="vap-row" key={data.p}>
                                <div className="vap-price">{data.p.toFixed(2)}</div>
                                <div className="vap-bar-container">
                                    <div className="vap-buy-bar" style={{ width: `${buyPct}%` }}></div>
                                    <div className="vap-sell-bar" style={{ width: `${sellPct}%` }}></div>
                                    <div className="vap-neutral-bar" style={{ width: `${neutralPct}%` }}></div>
                                    <div className="vap-text">
                                        {data.t} (C: {data.b} V: {data.s} N: {data.n})
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
