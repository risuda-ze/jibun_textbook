import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AiSettings } from '../ai/types'
import { useApp } from '../store'
import type { Textbook } from '../types'
import { StopButton, stepPercent, useElapsed } from './common'
import { GEN_STEPS, startGeneration, stopGeneration } from './generate'
import { Button } from './kit'
import { L } from './labels'
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
 * 資料の生成のひとまとまり（#90 #91）。レッスンとロードマップで同じ形。
 * 枠の中に「資料を渡す」→「資料を生成」を左から並べ、渡す欄はその下に開く。
 * 生成ボタンは押すと進行中の色になり、今していることと経過秒数が中に出る（#50 #55 #77）。「やめる」はその右（#14）。
 * `actions`（レッスンを開く／自分で書き始める）は枠の次の行、`note`（使うAI）は枠の下の sub。
 * `show=false` なら枠を出さず `actions` の行だけにする（本文がある節）
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
      {show && (
        <div className="gengroup" role="group" aria-label={L.generateGroup}>
          <div className="eyebrow">{L.generateGroup}</div>
          <MaterialPanel value={g.mat} onChange={g.setMat} disabled={g.busy}>
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
            {running && <StopButton onStop={() => g.stop(lessonId)} />}
          </MaterialPanel>
        </div>
      )}
      {show && note}
      {actions && <div className="row">{actions}</div>}
    </>
  )
}
