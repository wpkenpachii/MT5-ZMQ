import React, { useEffect, useState } from 'react';
import { wsManager } from '../wsStore';

export default function OrderBookWidget() {
    const [book, setBook] = useState([]);

    useEffect(() => {
        const handleBook = (newBook) => {
            const sortedBook = [...newBook].sort((a,b) => b.p - a.p);
            setBook(sortedBook);
        };
        const handleClear = () => setBook([]);

        wsManager.on('book', handleBook);
        wsManager.on('status_clear', handleClear);

        return () => {
            wsManager.off('book', handleBook);
            wsManager.off('status_clear', handleClear);
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="drag-handle">ORDER BOOK (DOM)</div>
            <div className="content" id="dom-container">
                {book.map((r, i) => (
                    <div className="dom-row" key={i}>
                        <div style={{ color: 'var(--green)' }}>{r.t === 'B' ? r.v : ''}</div>
                        <div className="price-cell">{r.p.toFixed(2)}</div>
                        <div style={{ color: 'var(--red)' }}>{r.t === 'S' ? r.v : ''}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
