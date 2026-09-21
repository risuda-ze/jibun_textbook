import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export function Roadmap({ textbook, onBack, onSelectSection }) {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const allSections = textbook.chapters.flatMap(ch => ch.sections.map(s => ({ ...s, chapterTitle: ch.title })));
    const currentIndex = allSections.findIndex(s => !s.done);
    if (isMobile) {
        return (_jsxs("div", { className: "screen roadmap mobile", children: [_jsx("h1", { children: textbook.title }), _jsx("button", { onClick: onBack, children: "\u672C\u68DA\u306B\u623B\u308B" }), _jsx("div", { className: "sections-list", children: textbook.chapters.map(chapter => (_jsxs("div", { className: "chapter", children: [_jsx("h2", { children: chapter.title }), chapter.sections.map((section) => (_jsxs("div", { className: `section-item ${section.status} ${currentIndex === allSections.findIndex(s => s.id === section.id) ? 'current' : ''}`, onClick: () => onSelectSection(section.id), children: [_jsxs("div", { className: "section-header", children: [_jsx("span", { className: "status", children: section.status }), section.review && _jsx("span", { className: "review-flag", children: "\u518D\u78BA\u8A8D" })] }), _jsx("h3", { children: section.title })] }, section.id)))] }, chapter.id))) })] }));
    }
    return (_jsxs("div", { className: "screen roadmap desktop", children: [_jsx("h1", { children: textbook.title }), _jsx("button", { onClick: onBack, children: "\u672C\u68DA\u306B\u623B\u308B" }), _jsx("div", { className: "timeline", children: textbook.chapters.map((chapter, chIdx) => (_jsxs("div", { className: "track", children: [_jsx("div", { className: "track-label", children: chapter.title }), _jsx("div", { className: "clips", children: chapter.sections.map((section, sIdx) => (_jsx("div", { className: `clip ${section.status} ${section.review ? 'review' : ''} ${currentIndex === chIdx * 100 + sIdx ? 'current' : ''}`, onClick: () => onSelectSection(section.id), title: section.title, children: _jsxs("div", { className: "clip-content", children: [section.title, section.review && _jsx("span", { className: "review-badge", children: "\u518D" })] }) }, section.id))) })] }, chapter.id))) })] }));
}
//# sourceMappingURL=Roadmap.js.map