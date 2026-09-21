import { useState, useEffect } from 'react'
import type { Textbook } from '../types'

interface RoadmapProps {
  textbook: Textbook
  onBack: () => void
  onSelectSection: (sectionId: string) => void
}

export function Roadmap({ textbook, onBack, onSelectSection }: RoadmapProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const allSections = textbook.chapters.flatMap(ch =>
    ch.sections.map(s => ({ ...s, chapterTitle: ch.title }))
  )

  const currentIndex = allSections.findIndex(s => !s.done)

  if (isMobile) {
    return (
      <div className="screen roadmap mobile">
        <h1>{textbook.title}</h1>
        <button onClick={onBack}>本棚に戻る</button>
        <div className="sections-list">
          {textbook.chapters.map(chapter => (
            <div key={chapter.id} className="chapter">
              <h2>{chapter.title}</h2>
              {chapter.sections.map((section) => (
                <div
                  key={section.id}
                  className={`section-item ${section.status} ${currentIndex === allSections.findIndex(s => s.id === section.id) ? 'current' : ''}`}
                  onClick={() => onSelectSection(section.id)}
                >
                  <div className="section-header">
                    <span className="status">{section.status}</span>
                    {section.review && <span className="review-flag">再確認</span>}
                  </div>
                  <h3>{section.title}</h3>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="screen roadmap desktop">
      <h1>{textbook.title}</h1>
      <button onClick={onBack}>本棚に戻る</button>
      <div className="timeline">
        {textbook.chapters.map((chapter, chIdx) => (
          <div key={chapter.id} className="track">
            <div className="track-label">{chapter.title}</div>
            <div className="clips">
              {chapter.sections.map((section, sIdx) => (
                <div
                  key={section.id}
                  className={`clip ${section.status} ${section.review ? 'review' : ''} ${currentIndex === chIdx * 100 + sIdx ? 'current' : ''}`}
                  onClick={() => onSelectSection(section.id)}
                  title={section.title}
                >
                  <div className="clip-content">
                    {section.title}
                    {section.review && <span className="review-badge">再</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
