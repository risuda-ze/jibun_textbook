import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { initDB, requestPersistentStorage } from './db';
import { Bookshelf } from './screens/Bookshelf';
import { Create } from './screens/Create';
import { Roadmap } from './screens/Roadmap';
import { Lesson } from './screens/Lesson';
import { Textbook } from './screens/Textbook';
export default function App() {
    const [screen, setScreen] = useState('bookshelf');
    const [currentTextbook, setCurrentTextbook] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const init = async () => {
            try {
                await initDB();
                await requestPersistentStorage();
            }
            catch (e) {
                console.error('Init error:', e);
            }
            setLoading(false);
        };
        init();
    }, []);
    if (loading) {
        return _jsx("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }, children: "\u8AAD\u307F\u8FBC\u307F\u4E2D..." });
    }
    return (_jsxs("div", { className: "app", children: [screen === 'bookshelf' && (_jsx(Bookshelf, { onSelectTextbook: (tb) => {
                    setCurrentTextbook(tb);
                    setScreen('roadmap');
                }, onCreateNew: () => setScreen('create') })), screen === 'create' && (_jsx(Create, { onBack: () => setScreen('bookshelf'), onCreateTextbook: (tb) => {
                    setCurrentTextbook(tb);
                    setScreen('roadmap');
                } })), screen === 'roadmap' && currentTextbook && (_jsx(Roadmap, { textbook: currentTextbook, onBack: () => setScreen('bookshelf'), onSelectSection: () => {
                    setScreen('lesson');
                } })), screen === 'lesson' && currentTextbook && (_jsx(Lesson, { textbook: currentTextbook, onBack: () => setScreen('roadmap') })), screen === 'textbook' && currentTextbook && (_jsx(Textbook, { textbook: currentTextbook, onBack: () => setScreen('bookshelf') }))] }));
}
//# sourceMappingURL=App.js.map