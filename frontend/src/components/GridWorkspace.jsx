import React, { useEffect, useRef } from 'react';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

export default function GridWorkspace({ children, layoutKey }) {
    const gridRef = useRef(null);

    useEffect(() => {
        const grid = GridStack.init({
            cellHeight: 60,
            margin: 6,
            handle: '.drag-handle',
            float: true
        });

        gridRef.current = grid;

        grid.on('change', () => {
            const layout = grid.save();
            localStorage.setItem(layoutKey, JSON.stringify(layout));
        });

        return () => {
             // Destroy the layout properly if component unmounts
             grid.destroy(false); // pass false because React handles dom unmount
        };
    }, [layoutKey]);

    return (
        <div className="workspace-container">
            <div className="grid-stack">
                {children}
            </div>
        </div>
    );
}
