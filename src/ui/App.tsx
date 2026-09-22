import { clearToast, currentBook, go, useApp, type Screen } from "../store";
import { Shelf } from "./Shelf";
import { Create } from "./Create";
import { Roadmap } from "./Roadmap";
import { LessonPage } from "./LessonPage";
import { Book } from "./Book";

const TABS: [Screen, string, boolean][] = [
    ["shelf", "本棚", false],
    ["new", "つくる", false],
    ["road", "ロードマップ", true],
    ["lesson", "レッスン", true],
    ["book", "教科書", true],
];

export function App() {
    const s = useApp();
    const tb = currentBook(s);
    if (!s.ready)
        return (
            <div className="app">
                <p className="empty">読み込み中…</p>
            </div>
        );
    const screen: Screen =
        !tb &&
        (s.screen === "road" || s.screen === "lesson" || s.screen === "book")
            ? "shelf"
            : s.screen;
    return (
        <div className="app">
            <header className="bar">
                <div className="brand">じぶん教科書</div>
                <nav className="tabs" role="tablist">
                    {TABS.map(([k, label, needsBook], i) => (
                        <button
                            key={k}
                            className="tab"
                            role="tab"
                            aria-selected={screen === k}
                            disabled={needsBook && !tb}
                            onClick={() => go(k)}
                        >
                            <span className="n">{i + 1}</span>
                            {label}
                        </button>
                    ))}
                </nav>
                {tb && (
                    <div className="mocknote">開いている教科書: {tb.title}</div>
                )}
            </header>
            <main className="stack">
                {screen === "shelf" && <Shelf />}
                {screen === "new" && <Create />}
                {screen === "road" && tb && <Roadmap tb={tb} />}
                {screen === "lesson" && tb && <LessonPage tb={tb} />}
                {screen === "book" && tb && <Book tb={tb} />}
            </main>
            {s.toast && (
                <div className="toast" role="status">
                    <span>{s.toast.msg}</span>
                    {s.toast.undo && (
                        <button
                            onClick={() => {
                                s.toast?.undo?.();
                                clearToast();
                            }}
                        >
                            元に戻す
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
