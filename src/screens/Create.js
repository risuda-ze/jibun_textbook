import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { saveTextbook } from '../db';
import { askConfirmation, designCourse, setAPIKey } from '../ai';
export function Create({ onBack, onCreateTextbook }) {
    const [apiKey, setApiKeyLocal] = useState('');
    const [learning, setLearning] = useState('');
    const [current, setCurrent] = useState('');
    const [time, setTime] = useState('');
    const [tools, setTools] = useState('');
    const [stage, setStage] = useState('input');
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState(['', '', '']);
    const [loading, setLoading] = useState(false);
    const handleAskConfirmation = async () => {
        if (!apiKey.trim()) {
            alert('APIキーを入力してください');
            return;
        }
        setAPIKey(apiKey);
        setLoading(true);
        try {
            const qs = await askConfirmation(learning, current, time, tools);
            setQuestions(qs.slice(0, 3));
            setStage('confirmation');
        }
        catch (e) {
            alert('エラー: ' + e.message);
        }
        finally {
            setLoading(false);
        }
    };
    const handleDesignCourse = async () => {
        setLoading(true);
        try {
            const design = await designCourse(learning, current, time, tools, answers.join('\n'));
            const now = Date.now();
            const textbook = {
                id: 'tb_' + now,
                title: learning,
                goal: learning,
                context: current,
                chapters: design.chapters.map((ch, i) => ({
                    id: 'ch_' + i,
                    title: ch.title,
                    sections: ch.sections.map((s, j) => ({
                        id: 's_' + i + '_' + j,
                        title: s.title,
                        goal: s.goal,
                        status: '未作成',
                        done: false,
                        review: false,
                        blocks: [],
                        hints: [],
                        checklist: [],
                        updatedAt: now
                    }))
                })),
                schemaVersion: 1,
                createdAt: now,
                updatedAt: now
            };
            await saveTextbook(textbook);
            onCreateTextbook(textbook);
        }
        catch (e) {
            alert('エラー: ' + e.message);
        }
        finally {
            setLoading(false);
        }
    };
    if (stage === 'input') {
        return (_jsxs("div", { className: "screen create", children: [_jsx("h1", { children: "\u3064\u304F\u308B" }), _jsx("input", { type: "password", placeholder: "Anthropic API \u30AD\u30FC", value: apiKey, onChange: (e) => setApiKeyLocal(e.target.value) }), _jsx("textarea", { placeholder: "\u5B66\u3073\u305F\u3044\u3053\u3068", value: learning, onChange: (e) => setLearning(e.target.value) }), _jsx("textarea", { placeholder: "\u4ECA\u3067\u304D\u308B\u3053\u3068", value: current, onChange: (e) => setCurrent(e.target.value) }), _jsx("textarea", { placeholder: "\u4F7F\u3048\u308B\u6642\u9593\u30FB\u671F\u9650", value: time, onChange: (e) => setTime(e.target.value) }), _jsx("textarea", { placeholder: "\u9053\u5177\u30FB\u74B0\u5883", value: tools, onChange: (e) => setTools(e.target.value) }), _jsxs("div", { className: "actions", children: [_jsx("button", { onClick: onBack, children: "\u623B\u308B" }), _jsx("button", { onClick: handleAskConfirmation, disabled: loading, className: "btn-primary", children: loading ? '処理中...' : '確認質問を表示' })] })] }));
    }
    if (stage === 'confirmation') {
        return (_jsxs("div", { className: "screen create", children: [_jsx("h1", { children: "\u78BA\u8A8D\u8CEA\u554F" }), questions.map((q, i) => (_jsxs("div", { children: [_jsx("p", { children: q }), _jsx("textarea", { value: answers[i], onChange: (e) => {
                                const newAnswers = [...answers];
                                newAnswers[i] = e.target.value;
                                setAnswers(newAnswers);
                            }, placeholder: "\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044" })] }, i))), _jsxs("div", { className: "actions", children: [_jsx("button", { onClick: () => setStage('input'), children: "\u623B\u308B" }), _jsx("button", { onClick: handleDesignCourse, disabled: loading, className: "btn-primary", children: loading ? '設計中...' : 'コース設計を作成' })] })] }));
    }
    return _jsx("div", {});
}
//# sourceMappingURL=Create.js.map