import { useRef, useState } from "react";
import {
    go,
    markExported,
    openBook,
    putBook,
    removeBook,
    toast,
    useApp,
} from "../store";
import { newChapter, newLesson, newTextbook, type Textbook } from "../types";
import {
    SIZE_WARN_BYTES,
    asCopy,
    byteSize,
    decideImport,
    exportJson,
    fileName,
    formatSize,
    parseImport,
} from "../lib/io";
import {
    allLessons,
    currentLesson,
    isMine,
    lessonNo,
    reviewCount,
} from "../lib/status";
import { Meter } from "./common";
import { Button, Card, PageHead, Pill } from "./kit";

export function downloadBook(tb: Textbook): void {
    const json = exportJson(tb);
    const size = byteSize(json);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
    );
    a.download = fileName(tb);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    markExported(tb.id);
    toast(
        size > SIZE_WARN_BYTES
            ? `書き出した（${formatSize(size)}）は8MBを超えています。添付上限に注意してください。`
            : `書き出した（${formatSize(size)}）`,
    );
}

const daysSince = (iso?: string): number | null =>
    iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;

export function Shelf() {
    const { books, lastExport } = useApp();
    const file = useRef<HTMLInputElement>(null);
    const [older, setOlder] = useState<{
        incoming: Textbook;
        existing: Textbook;
    } | null>(null);
    const [error, setError] = useState("");

    async function onFile(f: File | undefined) {
        if (!f) return;
        setError("");
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

            {older && (
                <Card
                    stack
                    tone="marigold"
                    role="alertdialog"
                    aria-label="古いファイルの読み込み"
                >
                    <p>
                        <b>読み込もうとしたファイルの方が古い。</b>「
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
                                toast("古い内容で上書きした", () =>
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
                                toast("別の本として追加した");
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
                    <p>まだ教科書がない。</p>
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
                                <div className="row">
                                    <Button
                                        v="soft"
                                        onClick={() => openBook(b.id)}
                                    >
                                        開く
                                    </Button>
                                    <Button
                                        v="outline"
                                        sm
                                        onClick={() => downloadBook(b)}
                                    >
                                        JSONを書き出す
                                    </Button>
                                    <Button
                                        v="outline"
                                        sm
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    `「${b.title}」を端末から消す？`,
                                                )
                                            )
                                                removeBook(b.id);
                                        }}
                                    >
                                        消す
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
                                                    ? "まだ一度も書き出していない"
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
