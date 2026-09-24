import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AiSettings } from '../ai'
import { useApp } from '../store'
import type { Textbook } from '../types'
import { StopButton, stepPercent, useElapsed } from './common'
import { GEN_STEPS, startGeneration, stopGeneration } from './generate'
import { Button } from './kit'
import { MaterialPanel, emptyMaterialInput, type MaterialInput } from './material'

/**
 * 「資料を生成」の操作（#82）。レッスンとロードマップで同じものを使う。
 * 進行中の状態は store が持つ（#87）。画面を離れても生成は続き、戻ってくれば進行中の表示が続く。
 * 渡す資料の欄だけは画面ごとの入力なので、ここで持つ
 */
export function useGenerate(tb: Textbook, ai: AiSettings) {
  const { running } = useApp()
  const [mat, setMat] = useState<MaterialInput>(emptyMaterialInput)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  async function start(lessonId: string): Promise<boolean> {
    const ok = await startGeneration(tb, lessonId, ai, mat)
    if (ok && mounted.current) setMat(emptyMaterialInput())
    // 画面を離れていたら「終わった後の操作」（レッスンを開くなど）はしない
    return ok && mounted.current
  }
  return { running, busy: Object.keys(running).length > 0, mat, setMat, start, stop: stopGeneration }
}
export type Generate = ReturnType<typeof useGenerate>

/**
 * 生成ボタン（押すと進行中の色になり、今していることと経過秒数が中に出る #50 #55 #77）・やめる（#14）・同じ行の他のボタン・資料を渡す欄（#63）。
 * `show=false` なら生成ボタンと資料の欄を出さず、`actions` だけの行にする（本文がある節）
 */
export function GenerateControls({
  g,
  lessonId,
  label,
  show = true,
  note,
  actions,
  onDone,
}: {
  g: Generate
  lessonId: string
  label: string
  show?: boolean
  note?: ReactNode
  actions?: ReactNode
  onDone?: () => void
}) {
  const running = g.running[lessonId]
  const seconds = useElapsed(!!running, running?.startedAt ?? null, running?.endedAt ?? null)
  return (
    <>
      <div className="row">
        {show && (
          <Button
            v="soft"
            disabled={g.busy}
            onClick={() => {
              void g.start(lessonId).then((ok) => {
                if (ok) onDone?.()
              })
            }}
            progress={running ? stepPercent(running.step, GEN_STEPS) : null}
            busy={running ? { label: running.detail, seconds, title: running.hint } : null}
          >
            {label}
          </Button>
        )}
        {running && <StopButton onStop={() => g.stop(lessonId)} />}
        {show && !running && note}
        {actions}
      </div>
      {show && <MaterialPanel value={g.mat} onChange={g.setMat} disabled={g.busy} />}
    </>
  )
}
