import { useRef, useState } from "react";
import {
    dropBroken,
    go,
    openBook,
    putBook,
    removeBook,
    toast,
    useApp,
} from "../store";
import { newChapter, newLesson, newTextbook, type Textbook } from "../types";
import {
    IMPORT_LIMIT_BYTES,
    asCopy,
    decideImport,
    formatSize,
    parseImport,
} from "../lib/io";
import {
    currentLesson,
    exportWarning,
    lessonNo,
    reviewCount,
} from "../lib/status";
import { Meter, downloadBook } from "./common";
import { Button, Card, PageHead, Pill } from "./kit";

export function Shelf() {
    const { books, lastExport, broken } = useApp();
    const file = useRef<HTMLInputElement>(null);
    const [older, setOlder] = useState<{
        incoming: Textbook;
        existing: Textbook;
    } | null>(null);
    const [error, setError] = useState("");

    async function onFile(f: File | undefined) {
        if (!f) return;
        setError("");
        if (f.size > IMPORT_LIMIT_BYTES)
            return setError(`「${f.name}」は大きすぎて読み込めません（${formatSize(f.size)}。上限は ${formatSize(IMPORT_LIMIT_BYTES)}）。`);
        const r = parseImport(await f.text());
        if (!r.ok)
            return setError(`「${f.name}」は読み込めませんでした。${r.reason}`);
        const existing = books.find((b) => b.id === r.tb.id);
        const d = decideImport(existing, r.tb);
        if (d === "add") {
            putBook(r.tb, false);
            toast(`「${r.tb.title}」を読み込みました。`);
        } else if (d === "overwrite") {
            putBook(r.tb, false);
            toast(`「${r.tb.title}」を新しい内容で上書きしました。`, () =>
                putBook(existing!, false),
            );
        } else if (d === "same") toast("同じ内容が存在します。");
        else setOlder({ incoming: r.tb, existing: existing! });
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
                <p className="err" role="alert">
                    {error}
                </p>
            )}

            {broken.length > 0 && (
                <Card stack tone="peach" aria-label="読めない教科書">
                    <p>
                        <b>読み込めない教科書が {broken.length} 冊あります。</b>
                        形式が壊れているか、古い版のデータです。生データを書き出して保管するか、消してください。
                    </p>
                    <div className="row">
                        {broken.map((b) => (
                            <span className="row" key={b.key}>
                                <span className="mono sub">{b.key}</span>
                                <Button v="outline" sm onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = URL.createObjectURL(new Blob([JSON.stringify(b.raw ?? null, null, 1)], { type: "application/json" }));
                                    a.download = `${b.key.replace(/[^a-z0-9_-]/gi, "_")}.raw.json`;
                                    document.body.appendChild(a); a.click(); a.remove();
                                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                                }}>生データを書き出す</Button>
                                <Button v="danger" sm onClick={() => { if (confirm("この生データを端末から消しますか？")) dropBroken(b.key); }}>消去</Button>
                            </span>
                        ))}
                    </div>
                </Card>
            )}

            {older && (
                <Card
                    stack
                    tone="marigold"
                    role="alertdialog"
                    aria-label="古いファイルの読み込み"
                >
                    <p>
                        <b>読み込もうとしたファイルの方が古いです。</b>「
                        {older.existing.title}」
                    </p>
                    <p className="sub mono">
                        端末:{" "}
                        {new Date(older.existing.updatedAt).toLocaleString(
                            "ja-JP",
                        )}{" "}
                        / ファイル:{" "}
                        {new Date(older.incoming.updatedAt).toLocaleString(
                            "ja-JP",
                        )}
                    </p>
                    <div className="row">
                        <Button
                            v="ghost"
                            onClick={() => {
                                const prev = older.existing;
                                putBook(older.incoming, false);
                                setOlder(null);
                                toast("古い内容で上書きしました", () =>
                                    putBook(prev, false),
                                );
                            }}
                        >
                            古い内容で上書き
                        </Button>
                        <Button
                            v="ghost"
                            onClick={() => {
                                putBook(asCopy(older.incoming), false);
                                setOlder(null);
                                toast("別の本として追加しました");
                            }}
                        >
                            別の本として追加
                        </Button>
                        <Button v="soft" onClick={() => setOlder(null)}>
                            やめる
                        </Button>
                    </div>
                </Card>
            )}

            {books.length === 0 ? (
                <Card className="empty">
                    <p>まだ教科書がありません。</p>
                </Card>
            ) : (
                <div className="shelf">
                    {books.map((b) => {
                        const cur = currentLesson(b);
                        // 書き出し忘れの判定は status.ts に切り出し、レッスン画面と共用（#16）
                        const warn = exportWarning(b, lastExport[b.id]);
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
                                                {warn.days === null
                                                    ? "まだ一度も書き出していません"
                                                    : `最後の書き出しから${warn.days}日`}
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
