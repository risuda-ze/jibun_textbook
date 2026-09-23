import { L } from './labels'
import { useState, type ReactNode } from 'react'
import type { AiSettings } from '../ai'
import type { Textbook } from '../types'
import { RunControls, stepPercent, useAbort } from './common'
import { GEN_STEPS, generateInto, startGen, type GenState } from './generate'
import { Button } from './kit'
import { MaterialPanel, emptyMaterialInput, type MaterialInput } from './material'

/**
 * 「資料を生成」の状態と操作（#82）。レッスンとロードマップで同じものを使う。
 * 状態は画面が持つ（ロードマップで別の節を選び直しても、進行中の生成は続く）
 */
export function useGenerate(tb: Textbook, ai: AiSettings) {
  const [gen, setGen] = useState<({ id: string } & GenState) | null>(null)
  // 渡す資料（#63）
  const [mat, setMat] = useState<MaterialInput>(emptyMaterialInput)
  const abort = useAbort()
  async function start(lessonId: string): Promise<boolean> {
    const g = { id: lessonId, ...startGen() }
    setGen(g)
    const ok = await generateInto(tb, lessonId, ai, (step, detail) => setGen({ ...g, step, detail }), abort.start(), mat)
    setGen(null)
    if (ok) setMat(emptyMaterialInput())
    return ok
  }
  return { gen, mat, setMat, start, stop: abort.stop }
}
export type Generate = ReturnType<typeof useGenerate>

/**
 * 生成ボタン（押すと進行中の色になる #50 #55）・今していることと経過秒数・やめる（#14）・同じ行の他のボタン・資料を渡す欄（#63）。
 * `show=false` なら生成ボタンと資料の欄を出さず、`actions` だけの行にする（本文がある節）
 */
export function GenerateControls({ g, lessonId, label, show = true, note, actions, onDone }: {
  g: Generate; lessonId: string; label: string; show?: boolean; note?: ReactNode; actions?: ReactNode; onDone?: () => void
}) {
  const running = g.gen?.id === lessonId ? g.gen : null
  return (
    <>
      <div className="row">
        {show && (
          <Button v="soft" disabled={g.gen !== null} onClick={() => { void g.start(lessonId).then((ok) => { if (ok) onDone?.() }) }} progress={running ? stepPercent(running.step, GEN_STEPS) : null}>
            {running ? L.generating : label}
          </Button>
        )}
        {running && <RunControls detail={running.detail} startedAt={running.startedAt} endedAt={running.endedAt} onStop={g.stop} />}
        {show && !running && note}
        {actions}
      </div>
      {show && <MaterialPanel value={g.mat} onChange={g.setMat} disabled={g.gen !== null} />}
    </>
  )
}
