import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import GridWorkspace from './components/GridWorkspace';
import ChartWidget from './components/ChartWidget';
import TimesAndSalesWidget from './components/TimesAndSalesWidget';
import VolumeAtPriceWidget from './components/VolumeAtPriceWidget';
import OrderBookWidget from './components/OrderBookWidget';
import FlowFiltersWidget from './components/FlowFiltersWidget';
import { wsManager } from './wsStore';

// Initialize the WebSocket
const WS_URL = "ws://127.0.0.1:8000/ws";

function App() {
  const [activeAsset, setActiveAsset] = useState("");
  const [globalMinVol, setGlobalMinVol] = useState(0);
  const [activeFilters, setActiveFilters] = useState([]);

  const [layout] = useState(() => {
    const saved = localStorage.getItem('alpha_workspace_layout_react_v1');
    const defaultLayout = {
      'widget-chart': { w: 5, h: 7, x: 0, y: 0 },
      'widget-ts': { w: 5, h: 5, x: 0, y: 7 },
      'widget-vap': { w: 4, h: 12, x: 5, y: 0 },
      'widget-dom': { w: 3, h: 6, x: 9, y: 0 },
      'widget-filters': { w: 3, h: 6, x: 9, y: 6 }
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.forEach(item => {
           if (item.id && defaultLayout[item.id]) {
             defaultLayout[item.id] = { ...defaultLayout[item.id], ...item };
           }
        });
      } catch (e) {}
    }
    return defaultLayout;
  });

  useEffect(() => {
    wsManager.connect(WS_URL);
    return () => {
      if (wsManager.ws) {
         wsManager.ws.close();
      }
    };
  }, []);

  const handleResetLayout = () => {
    localStorage.removeItem('alpha_workspace_layout_react_v1');
    window.location.reload();
  };

  return (
    <>
      <Toolbar 
        activeAsset={activeAsset}
        setActiveAsset={setActiveAsset}
        globalMinVol={globalMinVol}
        setGlobalMinVol={setGlobalMinVol}
        onResetLayout={handleResetLayout}
      />
      
      <GridWorkspace layoutKey="alpha_workspace_layout_react_v1">
        {/* Chart Widget */}
        <div className="grid-stack-item" gs-id="widget-chart" gs-w={layout['widget-chart'].w} gs-h={layout['widget-chart'].h} gs-x={layout['widget-chart'].x} gs-y={layout['widget-chart'].y}>
          <div className="grid-stack-item-content">
            <ChartWidget activeAsset={activeAsset} />
          </div>
        </div>

        {/* Times & Sales Widget */}
        <div className="grid-stack-item" gs-id="widget-ts" gs-w={layout['widget-ts'].w} gs-h={layout['widget-ts'].h} gs-x={layout['widget-ts'].x} gs-y={layout['widget-ts'].y}>
          <div className="grid-stack-item-content">
            <TimesAndSalesWidget 
              activeAsset={activeAsset} 
              globalMinVol={globalMinVol} 
              activeFilters={activeFilters} 
            />
          </div>
        </div>

        {/* Volume at Price Widget */}
        <div className="grid-stack-item" gs-id="widget-vap" gs-w={layout['widget-vap'].w} gs-h={layout['widget-vap'].h} gs-x={layout['widget-vap'].x} gs-y={layout['widget-vap'].y}>
          <div className="grid-stack-item-content">
            <VolumeAtPriceWidget activeAsset={activeAsset} />
          </div>
        </div>

        {/* Order Book Widget */}
        <div className="grid-stack-item" gs-id="widget-dom" gs-w={layout['widget-dom'].w} gs-h={layout['widget-dom'].h} gs-x={layout['widget-dom'].x} gs-y={layout['widget-dom'].y}>
          <div className="grid-stack-item-content">
            <OrderBookWidget />
          </div>
        </div>

        {/* Flow Filters Widget */}
        <div className="grid-stack-item" gs-id="widget-filters" gs-w={layout['widget-filters'].w} gs-h={layout['widget-filters'].h} gs-x={layout['widget-filters'].x} gs-y={layout['widget-filters'].y}>
          <div className="grid-stack-item-content" style={{ padding: 10 }}>
            <FlowFiltersWidget 
               activeAsset={activeAsset}
               activeFilters={activeFilters}
               setActiveFilters={setActiveFilters}
            />
          </div>
        </div>
      </GridWorkspace>
    </>
  );
}

export default App;
