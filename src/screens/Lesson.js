import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { saveTextbook } from '../db';
export function Lesson({ textbook, onBack }) {
    const [currentSectionId, setCurrentSectionId] = useState('');
    const [localTextbook, setLocalTextbook] = useState(textbook);
    const [editingBlockId, setEditingBlockId] = useState(null);
    useEffect(() => {
        const firstSection = localTextbook.chapters[0]?.sections[0];
        if (firstSection) {
            setCurrentSectionId(firstSection.id);
        }
    }, []);
    const findSection = () => {
        for (const ch of localTextbook.chapters) {
            const s = ch.sections.find(s => s.id === currentSectionId);
            if (s)
                return s;
        }
        return null;
    };
    const section = findSection();
    if (!section)
        return _jsx("div", { children: "\u30BB\u30AF\u30B7\u30E7\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    const handleEditBlock = (blockId, newContent) => {
        const updated = { ...localTextbook };
        for (const ch of updated.chapters) {
            const s = ch.sections.find(s => s.id === currentSectionId);
            if (s) {
                const block = s.blocks.find(b => b.id === blockId);
                if (block)
                    block.content = newContent;
                s.updatedAt = Date.now();
            }
        }
        setLocalTextbook(updated);
        setEditingBlockId(null);
    };
    const handleAddNote = (blockId) => {
        const content = prompt('ノートを追加');
        if (!content)
            return;
        const updated = { ...localTextbook };
        for (const ch of updated.chapters) {
            const s = ch.sections.find(s => s.id === currentSectionId);
            if (s) {
                const block = s.blocks.find(b => b.id === blockId);
                if (block) {
                    block.notes.push({
                        id: 'note_' + Date.now(),
                        type: 'text',
                        content,
                        timestamp: Date.now()
                    });
                }
                s.updatedAt = Date.now();
            }
        }
        setLocalTextbook(updated);
    };
    const handleToggleDone = async () => {
        const updated = { ...localTextbook };
        for (const ch of updated.chapters) {
            const s = ch.sections.find(s => s.id === currentSectionId);
            if (s) {
                s.done = !s.done;
                if (s.done)
                    s.status = '完了';
                else
                    s.status = s.blocks.length > 0 ? '書き込みあり' : 'AIの下書き';
                s.updatedAt = Date.now();
            }
        }
        setLocalTextbook(updated);
        await saveTextbook(updated);
    };
    return (_jsxs("div", { className: "screen lesson", children: [_jsxs("div", { className: "lesson-header", children: [_jsx("h1", { children: section.title }), _jsx("button", { onClick: onBack, children: "\u623B\u308B" })] }), _jsxs("div", { className: "lesson-content", children: [_jsx("div", { className: "blocks", children: section.blocks.map(block => (_jsxs("div", { className: `block ${block.author}`, children: [editingBlockId === block.id ? (_jsx("textarea", { autoFocus: true, value: block.content, onChange: (e) => {
                                        const updated = { ...localTextbook };
                                        for (const ch of updated.chapters) {
                                            const s = ch.sections.find(s => s.id === currentSectionId);
                                            if (s) {
                                                const b = s.blocks.find(b => b.id === block.id);
                                                if (b)
                                                    b.content = e.target.value;
                                            }
                                        }
                                        setLocalTextbook(updated);
                                    }, onBlur: () => {
                                        handleEditBlock(block.id, block.content);
                                    } })) : (_jsxs("div", { onClick: () => setEditingBlockId(block.id), className: "block-text", children: [block.content, _jsx("span", { className: "author-badge", children: block.author })] })), _jsx("div", { className: "notes", children: block.notes.map(note => (_jsx("div", { className: "note", children: note.content }, note.id))) }), _jsx("button", { onClick: () => handleAddNote(block.id), className: "btn-small", children: "\u30CE\u30FC\u30C8\u3092\u8FFD\u52A0" })] }, block.id))) }), _jsx("div", { className: "sidebar", children: _jsx("button", { onClick: handleToggleDone, className: `btn-primary ${section.done ? 'done' : ''}`, children: section.done ? '✓ 完了' : '完了にする' }) })] })] }));
}
//# sourceMappingURL=Lesson.js.map