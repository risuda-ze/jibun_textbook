import { useState, useEffect } from 'react'
import { saveTextbook } from '../db'
import type { Textbook } from '../types'

interface LessonProps {
  textbook: Textbook
  onBack: () => void
}

export function Lesson({ textbook, onBack }: LessonProps) {
  const [currentSectionId, setCurrentSectionId] = useState<string>('')
  const [localTextbook, setLocalTextbook] = useState(textbook)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

  useEffect(() => {
    const firstSection = localTextbook.chapters[0]?.sections[0]
    if (firstSection) {
      setCurrentSectionId(firstSection.id)
    }
  }, [])

  const findSection = () => {
    for (const ch of localTextbook.chapters) {
      const s = ch.sections.find(s => s.id === currentSectionId)
      if (s) return s
    }
    return null
  }

  const section = findSection()
  if (!section) return <div>セクションが見つかりません</div>

  const handleEditBlock = (blockId: string, newContent: string) => {
    const updated = { ...localTextbook }
    for (const ch of updated.chapters) {
      const s = ch.sections.find(s => s.id === currentSectionId)
      if (s) {
        const block = s.blocks.find(b => b.id === blockId)
        if (block) block.content = newContent
        s.updatedAt = Date.now()
      }
    }
    setLocalTextbook(updated)
    setEditingBlockId(null)
  }

  const handleAddNote = (blockId: string) => {
    const content = prompt('ノートを追加')
    if (!content) return

    const updated = { ...localTextbook }
    for (const ch of updated.chapters) {
      const s = ch.sections.find(s => s.id === currentSectionId)
      if (s) {
        const block = s.blocks.find(b => b.id === blockId)
        if (block) {
          block.notes.push({
            id: 'note_' + Date.now(),
            type: 'text',
            content,
            timestamp: Date.now()
          })
        }
        s.updatedAt = Date.now()
      }
    }
    setLocalTextbook(updated)
  }

  const handleToggleDone = async () => {
    const updated = { ...localTextbook }
    for (const ch of updated.chapters) {
      const s = ch.sections.find(s => s.id === currentSectionId)
      if (s) {
        s.done = !s.done
        if (s.done) s.status = '完了'
        else s.status = s.blocks.length > 0 ? '書き込みあり' : 'AIの下書き'
        s.updatedAt = Date.now()
      }
    }
    setLocalTextbook(updated)
    await saveTextbook(updated)
  }

  return (
    <div className="screen lesson">
      <div className="lesson-header">
        <h1>{section.title}</h1>
        <button onClick={onBack}>戻る</button>
      </div>

      <div className="lesson-content">
        <div className="blocks">
          {section.blocks.map(block => (
            <div key={block.id} className={`block ${block.author}`}>
              {editingBlockId === block.id ? (
                <textarea
                  autoFocus
                  value={block.content}
                  onChange={(e) => {
                    const updated = { ...localTextbook }
                    for (const ch of updated.chapters) {
                      const s = ch.sections.find(s => s.id === currentSectionId)
                      if (s) {
                        const b = s.blocks.find(b => b.id === block.id)
                        if (b) b.content = e.target.value
                      }
                    }
                    setLocalTextbook(updated)
                  }}
                  onBlur={() => {
                    handleEditBlock(block.id, block.content)
                  }}
                />
              ) : (
                <div onClick={() => setEditingBlockId(block.id)} className="block-text">
                  {block.content}
                  <span className="author-badge">{block.author}</span>
                </div>
              )}

              <div className="notes">
                {block.notes.map(note => (
                  <div key={note.id} className="note">
                    {note.content}
                  </div>
                ))}
              </div>

              <button onClick={() => handleAddNote(block.id)} className="btn-small">
                ノートを追加
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar">
          <button onClick={handleToggleDone} className={`btn-primary ${section.done ? 'done' : ''}`}>
            {section.done ? '✓ 完了' : '完了にする'}
          </button>
        </div>
      </div>
    </div>
  )
}
