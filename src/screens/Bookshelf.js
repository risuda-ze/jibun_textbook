import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listTextbooks, deleteTextbook } from '../db';
export function Bookshelf({ onSelectTextbook, onCreateNew }) {
    const [textbooks, setTextbooks] = useState([]);
    useEffect(() => {
        const load = async () => {
            const items = await listTextbooks();
            setTextbooks(items);
        };
        load();
    }, []);
    const handleDelete = async (id) => {
        if (confirm('削除しますか？')) {
            await deleteTextbook(id);
            setTextbooks(textbooks.filter(t => t.id !== id));
        }
    };
    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                JSON.parse(evt.target?.result);
                // TODO: import logic
            }
            catch (err) {
                alert('ファイルが破損しています');
            }
        };
        reader.readAsText(file);
    };
    return (_jsxs("div", { className: "screen bookshelf", children: [_jsx("h1", { children: "\u672C\u68DA" }), _jsx("div", { className: "textbooks-grid", children: textbooks.map(tb => (_jsxs("div", { className: "textbook-card", onClick: () => onSelectTextbook(tb), children: [_jsx("h3", { children: tb.title }), _jsx("p", { children: tb.goal }), _jsxs("small", { children: ["\u66F4\u65B0: ", new Date(tb.updatedAt).toLocaleDateString('ja-JP')] }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                handleDelete(tb.id);
                            }, children: "\u524A\u9664" })] }, tb.id))) }), _jsxs("div", { className: "actions", children: [_jsx("button", { onClick: onCreateNew, className: "btn-primary", children: "+ \u3064\u304F\u308B" }), _jsxs("label", { className: "btn-secondary", children: ["\u8AAD\u307F\u8FBC\u3080", _jsx("input", { type: "file", accept: ".json", onChange: handleImport, style: { display: 'none' } })] })] })] }));
}
//# sourceMappingURL=Bookshelf.js.map