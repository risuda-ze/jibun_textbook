import { useState, useEffect } from 'react'
import { initDB, requestPersistentStorage } from './db'
import { Bookshelf } from './screens/Bookshelf'
import { Create } from './screens/Create'
import { Roadmap } from './screens/Roadmap'
import { Lesson } from './screens/Lesson'
import { Textbook } from './screens/Textbook'
import type { Textbook as TextbookType } from './types'

type Screen = 'bookshelf' | 'create' | 'roadmap' | 'lesson' | 'textbook'

export default function App() {
  const [screen, setScreen] = useState<Screen>('bookshelf')
  const [currentTextbook, setCurrentTextbook] = useState<TextbookType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
        await requestPersistentStorage()
      } catch (e) {
        console.error('Init error:', e)
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      読み込み中...
    </div>
  }

  return (
    <div className="app">
      {screen === 'bookshelf' && (
        <Bookshelf
          onSelectTextbook={(tb) => {
            setCurrentTextbook(tb)
            setScreen('roadmap')
          }}
          onCreateNew={() => setScreen('create')}
        />
      )}
      {screen === 'create' && (
        <Create
          onBack={() => setScreen('bookshelf')}
          onCreateTextbook={(tb) => {
            setCurrentTextbook(tb)
            setScreen('roadmap')
          }}
        />
      )}
      {screen === 'roadmap' && currentTextbook && (
        <Roadmap
          textbook={currentTextbook}
          onBack={() => setScreen('bookshelf')}
          onSelectSection={() => {
            setScreen('lesson')
          }}
        />
      )}
      {screen === 'lesson' && currentTextbook && (
        <Lesson
          textbook={currentTextbook}
          onBack={() => setScreen('roadmap')}
        />
      )}
      {screen === 'textbook' && currentTextbook && (
        <Textbook
          textbook={currentTextbook}
          onBack={() => setScreen('bookshelf')}
        />
      )}
    </div>
  )
}
