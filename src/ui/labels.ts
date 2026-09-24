/**
 * 画面の文言のうち、通しテストが操作に使うもの（#84）。UI と e2e が同じ定数を参照し、文言を変えても片方だけ直し忘れない。
 * ここに無い文言は e2e に直接書いてよい（頻出のものだけ置く）。React に依存しない（e2e から import するため）
 */
export const L = {
  newWithAi: 'AIと新規作成',
  help: 'Help',
  design: '調べてコース設計を作る',
  generateLesson: 'この節の資料を生成',
  generate: '資料を生成',
  stop: 'やめる',
  startWriting: '自分で書き始める',
  write: '書き込む',
  roadmap: 'ロードマップ',
  propose: '変更案を出してもらう',
  material: '資料を渡す',
  generateGroup: 'まだ資料がありません。AI生成または自分で書き始めてください。',
  clearLesson: '資料を消す',
} as const
