import { useState } from 'react'
import { saveTextbook } from '../db'
import { askConfirmation, designCourse, setAPIKey } from '../ai'
import type { Textbook } from '../types'

interface CreateProps {
  onBack: () => void
  onCreateTextbook: (textbook: Textbook) => void
}

export function Create({ onBack, onCreateTextbook }: CreateProps) {
  const [apiKey, setApiKeyLocal] = useState('')
  const [learning, setLearning] = useState('')
  const [current, setCurrent] = useState('')
  const [time, setTime] = useState('')
  const [tools, setTools] = useState('')
  const [stage, setStage] = useState<'input' | 'confirmation' | 'design'>('input')
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState(['', '', ''])
  const [loading, setLoading] = useState(false)

  const handleAskConfirmation = async () => {
    if (!apiKey.trim()) {
      alert('APIキーを入力してください')
      return
    }
    setAPIKey(apiKey)
    setLoading(true)
    try {
      const qs = await askConfirmation(learning, current, time, tools)
      setQuestions(qs.slice(0, 3))
      setStage('confirmation')
    } catch (e) {
      alert('エラー: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDesignCourse = async () => {
    setLoading(true)
    try {
      const design = await designCourse(learning, current, time, tools, answers.join('\n'))
      const now = Date.now()
      const textbook: Textbook = {
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
      }
      await saveTextbook(textbook)
      onCreateTextbook(textbook)
    } catch (e) {
      alert('エラー: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (stage === 'input') {
    return (
      <div className="screen create">
        <h1>つくる</h1>
        <input
          type="password"
          placeholder="Anthropic API キー"
          value={apiKey}
          onChange={(e) => setApiKeyLocal(e.target.value)}
        />
        <textarea
          placeholder="学びたいこと"
          value={learning}
          onChange={(e) => setLearning(e.target.value)}
        />
        <textarea
          placeholder="今できること"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <textarea
          placeholder="使える時間・期限"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <textarea
          placeholder="道具・環境"
          value={tools}
          onChange={(e) => setTools(e.target.value)}
        />
        <div className="actions">
          <button onClick={onBack}>戻る</button>
          <button onClick={handleAskConfirmation} disabled={loading} className="btn-primary">
            {loading ? '処理中...' : '確認質問を表示'}
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'confirmation') {
    return (
      <div className="screen create">
        <h1>確認質問</h1>
        {questions.map((q, i) => (
          <div key={i}>
            <p>{q}</p>
            <textarea
              value={answers[i]}
              onChange={(e) => {
                const newAnswers = [...answers]
                newAnswers[i] = e.target.value
                setAnswers(newAnswers)
              }}
              placeholder="回答してください"
            />
          </div>
        ))}
        <div className="actions">
          <button onClick={() => setStage('input')}>戻る</button>
          <button onClick={handleDesignCourse} disabled={loading} className="btn-primary">
            {loading ? '設計中...' : 'コース設計を作成'}
          </button>
        </div>
      </div>
    )
  }

  return <div></div>
}
