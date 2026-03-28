import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { wsManager } from '../wsStore';

export default function ChartWidget({ activeAsset }) {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const currentCandleRef = useRef(null);
    const chartTimeframe = 60; // 1 minute candles from tick live

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Initialize chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: { background: { type: 'solid', color: '#0d1117' }, textColor: '#c9d1d9' },
            grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderColor: '#30363d' },
            timeScale: { borderColor: '#30363d', timeVisible: true, secondsVisible: false }
        });

        const series = chart.addCandlestickSeries({
            upColor: '#238636', downColor: '#da3633', borderVisible: false,
            wickUpColor: '#238636', wickDownColor: '#da3633'
        });

        chartRef.current = chart;
        seriesRef.current = series;

        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width, height: newRect.height });
        });
        resizeObserver.observe(chartContainerRef.current);

        // WS Listeners
        const processHistoricalCandles = (data) => {
            if (!data || data.length === 0 || !seriesRef.current) return;
            let mappedData = data.map(d => ({ time: d.t, open: d.o, high: d.h, low: d.l, close: d.c }));
            mappedData.sort((a, b) => a.time - b.time);
            
            const uniqueData = [];
            mappedData.forEach(item => {
                if (uniqueData.length === 0 || uniqueData[uniqueData.length - 1].time !== item.time) {
                    uniqueData.push(item);
                }
            });

            try {
                seriesRef.current.setData(uniqueData);
                currentCandleRef.current = uniqueData[uniqueData.length - 1];
            } catch (error) {
                console.error("Erro ao injetar velas no TradingView:", error);
            }
        };

        const updateLiveCandle = (t) => {
            if (!seriesRef.current) return;
            const tickTimeSec = Math.floor(t.ms / 1000);
            const candleTime = Math.floor(tickTimeSec / chartTimeframe) * chartTimeframe;
            let currentCandle = currentCandleRef.current;

            if (!currentCandle || currentCandle.time !== candleTime) {
                currentCandle = { time: candleTime, open: t.p, high: t.p, low: t.p, close: t.p };
            } else {
                currentCandle.high = Math.max(currentCandle.high, t.p);
                currentCandle.low = Math.min(currentCandle.low, t.p);
                currentCandle.close = t.p;
            }
            seriesRef.current.update(currentCandle);
            currentCandleRef.current = currentCandle;
        };

        const handleTick = (tick) => updateLiveCandle(tick);
        const handleClear = () => {
             if (seriesRef.current) {
                 // Clear out the series data safely
                 seriesRef.current.setData([]);
             }
             currentCandleRef.current = null;
        };

        wsManager.on('candles', processHistoricalCandles);
        wsManager.on('tick', handleTick);
        wsManager.on('status_clear', handleClear);

        return () => {
            resizeObserver.disconnect();
            wsManager.off('candles', processHistoricalCandles);
            wsManager.off('tick', handleTick);
            wsManager.off('status_clear', handleClear);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
            }
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="drag-handle">
                CHART <span style={{ color: 'var(--blue)' }}>{activeAsset || '---'}</span>
            </div>
            <div id="chart-container" ref={chartContainerRef} style={{ width: '100%', flexGrow: 1, position: 'relative' }}></div>
        </div>
    );
}
