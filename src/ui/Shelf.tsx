import { useRef, useState } from "react";
import {
    dropBroken,
    go,
    openRepair,
    openBook,
    putBook,
    removeBook,
    useApp,
} from "../store";
import { newChapter, newLesson, newTextbook } from "../types";
import { readTextbookFile } from "../lib/io";
import { downloadText } from "../lib/download";
import { OlderCard, importTextbook, type Older } from "./import";
import {
    allLessons,
    currentLesson,
    isMine,
    lessonNo,
    reviewCount,
} from "../lib/status";
import { Meter, downloadBook } from "./common";
import { Button, Card, PageHead, Pill } from "./kit";

const daysSince = (iso?: string): number | null =>
    iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;

export function Shelf() {
    const { books, lastExport, broken } = useApp();
    const file = useRef<HTMLInputElement>(null);
    const [older, setOlder] = useState<Older | null>(null);
    const [error, setError] = useState("");

    async function onFile(f: File | undefined) {
        if (!f) return;
        setError("");
        // 読み込みの判定は Help の「本棚に追加」と同じ道を通す（#78）
        const r = await readTextbookFile(f);
        if (!r.ok) return setError(`「${f.name}」は読み込めませんでした。${r.reason}`);
        const o = importTextbook(r.tb, r.steps, books);
        if (!o.done) setOlder(o.older);
    }

    function blank() {
        const tb = newTextbook("新しい教科書", {
            chapters: [newChapter("第1章", [newLesson("最初の節")])],
        });
        putBook(tb);
        openBook(tb.id);
    }

    return (
        <>
            <PageHead
                eyebrow="本棚"
                title="myTextbook"
                lead="「学習計画を設計する」 → 「資料を一次作成」 → 「手を動かしながら、書き込む」"
                actions={
                    <>
                        <Button v="ghost" onClick={() => go("help")}>
                            Help
                        </Button>
                        <Button v="ghost" onClick={() => file.current?.click()}>
                            JSON読込
                        </Button>
                        <Button v="ghost" onClick={blank}>
                            白紙から作る
                        </Button>
                        <Button v="primary" onClick={() => go("new")}>
                            AIと新規作成
                        </Button>
                        <input
                            ref={file}
                            type="file"
                            id="importfile"
                            accept=".json,application/json"
                            hidden
                            onChange={(e) => {
                                void onFile(e.target.files?.[0]);
                                e.target.value = "";
                            }}
                        />
                    </>
                }
            />

            {error && (
                <div className="row" style={{ alignItems: "baseline" }}>
                    <p className="err" role="alert">
                        {error}
                    </p>
                    {/* 失敗文の近くから Help の対処へ（#64） */}
                    <Button v="outline" sm onClick={() => go("help")}>
                        読み込めない場合、まずはこちら
                    </Button>
                </div>
            )}

            {broken.length > 0 && (
                <Card stack tone="peach" aria-label="読めない教科書">
                    <p>
                        <b>読み込めない教科書が {broken.length} 冊あります。</b>
                        形式が壊れているか、古い版のデータです。「Help で直す」で版の移行と修復を試せます。生データを書き出して保管するか、消すこともできます。
                    </p>
                    <div className="row">
                        {broken.map((b) => (
                            <span className="row" key={b.key}>
                                <span className="mono sub">{b.key}</span>
                                <Button v="outline" sm onClick={() => downloadText(`${b.key.replace(/[^a-z0-9_-]/gi, "_")}.raw.json`, JSON.stringify(b.raw ?? null, null, 1))}>生データを書き出す</Button>
                                <Button v="outline" sm onClick={() => openRepair(b.key, b.raw)}>Help で直す</Button>
                                <Button v="danger" sm onClick={() => { if (confirm("この生データを端末から消しますか？")) dropBroken(b.key); }}>消去</Button>
                            </span>
                        ))}
                    </div>
                </Card>
            )}

            {older && <OlderCard older={older} onDone={() => setOlder(null)} />}

            {books.length === 0 ? (
                <Card className="empty">
                    <p>まだ教科書がありません。</p>
                </Card>
            ) : (
                <div className="shelf">
                    {books.map((b) => {
                        const cur = currentLesson(b);
                        const d = daysSince(lastExport[b.id]);
                        const hasMine = allLessons(b).some((l) =>
                            l.blocks.some(isMine),
                        );
                        const warn = hasMine && (d === null || d >= 7);
                        const rv = reviewCount(b);
                        return (
                            <Card stack key={b.id}>
                                <div>
                                    <h2>{b.title}</h2>
                                    {b.goal && <p className="sub">{b.goal}</p>}
                                </div>
                                <Meter tb={b} />
                                {/* 左から「JSON書出」「消去」「開く」。主操作の「開く」を右端に置き、右揃えにする */}
                                <div className="row card-actions">
                                    <Button
                                        v="outline"
                                        sm
                                        onClick={() => downloadBook(b)}
                                    >
                                        JSON書出
                                    </Button>
                                    <Button
                                        v="danger"
                                        sm
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    `「${b.title}」を端末から消しますか？`,
                                                )
                                            )
                                                removeBook(b.id);
                                        }}
                                    >
                                        消去
                                    </Button>
                                    <Button
                                        v="soft"
                                        onClick={() => openBook(b.id)}
                                    >
                                        開く
                                    </Button>
                                </div>
                                <p className="sub" style={{ fontSize: 13 }}>
                                    {cur
                                        ? `続き: ${lessonNo(b, cur.id)} ${cur.title}`
                                        : "すべて完了"}
                                    {rv > 0 && ` ・再確認 ${rv}件`}
                                    {warn && (
                                        <>
                                            <br />
                                            <Pill tone="review">
                                                {d === null
                                                    ? "まだ一度も書き出していません"
                                                    : `最後の書き出しから${d}日`}
                                            </Pill>
                                        </>
                                    )}
                                </p>
                            </Card>
                        );
                    })}
                </div>
            )}
        </>
    );
}
