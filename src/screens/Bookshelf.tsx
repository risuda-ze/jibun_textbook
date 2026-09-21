import { useEffect, useState } from 'react'
import { listTextbooks, deleteTextbook } from '../db'
import type { Textbook } from '../types'

interface BookshelfProps {
  onSelectTextbook: (textbook: Textbook) => void
  onCreateNew: () => void
}

export function Bookshelf({ onSelectTextbook, onCreateNew }: BookshelfProps) {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])

  useEffect(() => {
    const load = async () => {
      const items = await listTextbooks()
      setTextbooks(items)
    }
    load()
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('削除しますか？')) {
      await deleteTextbook(id)
      setTextbooks(textbooks.filter(t => t.id !== id))
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string)
        // TODO: import logic
      } catch (err) {
        alert('ファイルが破損しています')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="screen bookshelf">
      <h1>本棚</h1>
      <div className="textbooks-grid">
        {textbooks.map(tb => (
          <div key={tb.id} className="textbook-card" onClick={() => onSelectTextbook(tb)}>
            <h3>{tb.title}</h3>
            <p>{tb.goal}</p>
            <small>更新: {new Date(tb.updatedAt).toLocaleDateString('ja-JP')}</small>
            <button onClick={(e) => {
              e.stopPropagation()
              handleDelete(tb.id)
            }}>削除</button>
          </div>
        ))}
      </div>
      <div className="actions">
        <button onClick={onCreateNew} className="btn-primary">+ つくる</button>
        <label className="btn-secondary">
          読み込む
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  )
}
