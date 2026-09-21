import type { Textbook as TextbookType } from '../types'

interface TextbookProps {
  textbook: TextbookType
  onBack: () => void
}

export function Textbook({ textbook, onBack }: TextbookProps) {
  return (
    <div className="screen textbook">
      <div className="textbook-header">
        <h1>{textbook.title}</h1>
        <button onClick={onBack}>戻る</button>
      </div>

      <div className="textbook-content">
        {textbook.chapters.map(chapter => (
          <div key={chapter.id} className="chapter">
            <h2>{chapter.title}</h2>
            {chapter.sections.map(section => (
              <div key={section.id} className="section">
                <h3>{section.title}</h3>
                {section.blocks.map(block => (
                  <div key={block.id} className={`block ${block.author}`}>
                    <p>{block.content}</p>
                    {block.notes.length > 0 && (
                      <div className="notes">
                        {block.notes.map(note => (
                          <div key={note.id} className="note">
                            <small>{note.content}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
