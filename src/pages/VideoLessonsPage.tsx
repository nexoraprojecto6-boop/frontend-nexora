import { useNavigate } from 'react-router-dom'

// ============================================================
// SINISTRO X — Vídeo-aulas das estratégias
//
// Edita esta lista para adicionar/remover aulas. O "videoId" é a
// parte do link do YouTube depois de "v=" — por exemplo, no link
// https://www.youtube.com/watch?v=dQw4w9WgXcQ
// o videoId é: dQw4w9WgXcQ
//
// Os vídeos ficam embutidos via <iframe> do YouTube (embed oficial),
// por isso o utilizador assiste sem sair da app.
// ============================================================

interface Lesson {
  id: string
  title: string
  description?: string
  videoId: string
}

const LESSONS: Lesson[] = [
  {
    id: 'aula-1',
    title: 'Introdução à NEXORA FOREX by DERIV',
    description: 'Conhece a plataforma e aprende a abrir as tuas primeiras operações na Deriv.',
    videoId: 'PVITi2GBLII',
  },
  {
    id: 'aula-2',
    title: 'Estratégia ALFHA',
    description: 'Como operar com a estratégia ALFHA e os primeiros passos para começares a usá-la.',
    videoId: '5jIRVtpRpSg',
  },
  {
    id: 'aula-3',
    title: 'Estratégia SCALPER',
    description: 'Como operar com a estratégia SCALPER e os primeiros passos na Deriv.',
    videoId: 'erLFyZ5xVjM',
  },
  {
    id: 'aula-4',
    title: 'Recomendações e Primeiros Passos',
    description: 'Recomendações importantes e como seguir os primeiros passos essenciais na Deriv.',
    videoId: 'Ylp5UlrJQjk',
  },
]

export default function VideoLessonsPage() {
  const navigate = useNavigate()
  const goBack = () => navigate('/menu')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ position: 'sticky', top: 0, background: 'rgba(7,11,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={goBack} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="logo-text" style={{ fontSize: 18 }}>APRENDE A OPERAR</h1>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {LESSONS.map((lesson, index) => (
          <div key={lesson.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${lesson.videoId}`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent, #7c9fff)',
                  background: 'rgba(124,159,255,0.12)', padding: '2px 8px', borderRadius: 999,
                }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 14 }}>{lesson.title}</p>
              </div>
              {lesson.description && (
                <p style={{ color: 'var(--text-faint)', fontSize: 12.5, lineHeight: 1.5 }}>{lesson.description}</p>
              )}
            </div>
          </div>
        ))}

        {LESSONS.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Ainda não há vídeo-aulas disponíveis.</p>
          </div>
        )}
      </div>
    </div>
  )
}
