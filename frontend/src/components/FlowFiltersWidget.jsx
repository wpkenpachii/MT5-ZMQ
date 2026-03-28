import React, { useEffect } from 'react';
import { audioLibrary } from './TimesAndSalesWidget';

export default function FlowFiltersWidget({ activeAsset, activeFilters, setActiveFilters }) {
    
    // Load filters whenever the active asset changes
    useEffect(() => {
        if (!activeAsset) {
            setActiveFilters([]);
            return;
        }
        const saved = localStorage.getItem(`cfg_${activeAsset}`);
        if (saved) {
            setActiveFilters(JSON.parse(saved));
        } else {
            setActiveFilters([{ min: 50, color: "#58a6ff", sound: 0 }]);
        }
    }, [activeAsset, setActiveFilters]);

    // Save filters whenever they change and we have an active asset
    useEffect(() => {
        if (activeAsset && activeFilters.length > 0) {
            localStorage.setItem(`cfg_${activeAsset}`, JSON.stringify(activeFilters));
        }
    }, [activeFilters, activeAsset]);

    const addFilter = () => {
        setActiveFilters(prev => [...prev, { min: 100, color: "#da3633", sound: 0 }]);
    };

    const updateFilter = (index, key, value) => {
        setActiveFilters(prev => {
            const next = [...prev];
            next[index][key] = key === 'min' || key === 'sound' ? Number(value) : value;
            return next;
        });
    };

    const removeFilter = (index) => {
        setActiveFilters(prev => prev.filter((_, i) => i !== index));
    };

    const playPreview = (soundIndex) => {
        const index = Number(soundIndex);
        if (index > 0 && audioLibrary[index].u) {
            try {
                new Audio(audioLibrary[index].u).play().catch(()=>{});
            } catch(e) {}
        }
    };

    return (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="drag-handle" style={{ background: 'none', border: 'none', padding: '0 0 10px 0' }}>FILTROS DE FLUXO</div>
            <div className="content" id="filters-list" style={{ paddingRight: 5, overflowY: 'auto', flexGrow: 1 }}>
                {activeFilters.map((f, i) => (
                    <div className="filter-card" key={i}>
                        <div className="filter-row">
                            <label style={{ fontSize: 10, fontWeight: 'bold' }}>LOTE {'>='}</label>
                            <input 
                                type="number" 
                                value={f.min} 
                                onChange={(e) => updateFilter(i, 'min', e.target.value)} 
                                style={{ width: 70 }}
                            />
                            <input 
                                type="color" 
                                value={f.color} 
                                onChange={(e) => updateFilter(i, 'color', e.target.value)} 
                                style={{ padding: 0, width: 30, height: 26 }}
                            />
                            <button 
                                onClick={() => removeFilter(i)} 
                                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
                            >X</button>
                        </div>
                        <select 
                            value={String(f.sound)} 
                            onChange={(e) => updateFilter(i, 'sound', e.target.value)}
                            style={{ width: '100%' }}
                        >
                            {audioLibrary.map((s, si) => (
                                <option key={si} value={si}>{s.n}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
            
            <button 
                onClick={addFilter} 
                style={{ width: '100%', marginTop: 5, marginBottom: 10, cursor: 'pointer', background: '#21262d', border: '1px dashed var(--blue)', color: 'var(--blue)' }}
            >
                + REGRA
            </button>
            
            <div className="drag-handle" style={{ background: 'none', border: 'none', padding: '10px 0' }}>TESTE DE ÁUDIO</div>
            <select id="audio-tester" onChange={(e) => playPreview(e.target.value)} style={{ width: '100%' }} defaultValue="0">
                {audioLibrary.map((s, si) => (
                    <option key={si} value={si}>{s.n}</option>
                ))}
            </select>
        </div>
    );
}
