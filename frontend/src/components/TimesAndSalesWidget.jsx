import React, { useEffect, useState } from 'react';
import { wsManager } from '../wsStore';

// We'll keep audio instances outside so we don't recreate them unless needed
const audioLibrary = [
    { n: "Nenhum (Silêncio)", u: "" },
    { n: "Beep Curto", u: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" },
    { n: "Alerta Digital", u: "https://actions.google.com/sounds/v1/alarms/digital_alarm_clock.ogg" },
    { n: "Sonar Ping", u: "https://actions.google.com/sounds/v1/alarms/sonar_ping.ogg" },
    { n: "Laser", u: "https://actions.google.com/sounds/v1/scifi/sci-fi_laser.ogg" }
];

export default function TimesAndSalesWidget({ activeAsset, globalMinVol, activeFilters }) {
    const [trades, setTrades] = useState([]);

    useEffect(() => {
        let currentTrades = [];
        
        const formatTrade = (t) => {
            let bgColor = 'transparent';
            let borderLeft = 'none';

            const sortedFilters = [...activeFilters].sort((a,b) => b.min - a.min);
            for (let f of sortedFilters) {
                if (t.v >= f.min) {
                    bgColor = f.color + "22";
                    borderLeft = `4px solid ${f.color}`;
                    // We avoid playing sounds during batch loads like vap_snapshot
                    break;
                }
            }

            const time = new Date(t.ms).toLocaleTimeString('pt-BR', {hour12:false});
            let sideColor = 'var(--neutral)';
            if(t.side === 'B') sideColor = 'var(--green)';
            if(t.side === 'S') sideColor = 'var(--red)';

            return {
                id: t.ms + Math.random().toString(),
                time,
                price: t.p.toFixed(2),
                vol: t.v,
                side: t.side,
                sideColor,
                bgColor,
                borderLeft
            };
        };

        const handleTick = (t) => {
            if (t.v < globalMinVol) return;

            // Play sound only on live ticks
            const sortedFilters = [...activeFilters].sort((a,b) => b.min - a.min);
            for (let f of sortedFilters) {
                if (t.v >= f.min && f.sound > 0 && audioLibrary[f.sound].u) {
                    try {
                        new Audio(audioLibrary[f.sound].u).play().catch(()=>{});
                    } catch (e) {}
                    break;
                }
            }

            const newTrade = formatTrade(t);
            currentTrades = [newTrade, ...currentTrades];
            if (currentTrades.length > 100) {
                currentTrades = currentTrades.slice(0, 100);
            }
            setTrades([...currentTrades]);
        };

        const handleVapSnapshot = (ticks) => {
            if (!ticks || ticks.length === 0) return;
            // Filter by min vol
            const filtered = ticks.filter(t => t.v >= globalMinVol);
            // Take the last 100 ticks (which are the most recent)
            const last100 = filtered.slice(-100);
            // Format and reverse them to have newest at top
            const formatted = last100.map(formatTrade).reverse();
            
            // Merge into current trades (if not already full) 
            // In a fresh start, currentTrades is empty so we just set it.
            // But to avoid duplicate trades if snapshot overlaps with live ticks, 
            // it's safer to just overwrite currentTrades entirely when a snapshot arrives.
            currentTrades = formatted;
            setTrades([...currentTrades]);
        };

        const handleClear = () => {
            currentTrades = [];
            setTrades([]);
        };

        wsManager.on('tick', handleTick);
        wsManager.on('vap_snapshot', handleVapSnapshot);
        wsManager.on('status_clear', handleClear);

        return () => {
            wsManager.off('tick', handleTick);
            wsManager.off('vap_snapshot', handleVapSnapshot);
            wsManager.off('status_clear', handleClear);
        };
    }, [globalMinVol, activeFilters]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="drag-handle">
                TIMES & SALES <span style={{ color: 'var(--blue)' }}>{activeAsset || '---'}</span>
            </div>
            <div className="content" id="ts-container">
                {trades.map(tr => (
                    <div className="trade-row" key={tr.id} style={{ background: tr.bgColor, borderLeft: tr.borderLeft }}>
                        <span>{tr.time}</span>
                        <span style={{ color: tr.sideColor }}>{tr.price}</span>
                        <span style={{ fontWeight: 'bold' }}>{tr.vol}</span>
                        <span style={{ color: tr.sideColor }}>{tr.side}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export { audioLibrary };
