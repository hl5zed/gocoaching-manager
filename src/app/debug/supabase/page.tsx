import { createClient } from '@supabase/supabase-js'

export default async function SupabaseDebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const hasUrl = Boolean(supabaseUrl)
  const hasAnonKey = Boolean(supabaseAnonKey)

  let dbStatus = 'not_tested'
  let errorMessage = ''
  let languages: Array<{
    id?: string
    code?: string
    name?: string
    native_name?: string
  }> = []

  if (hasUrl && hasAnonKey) {
    try {
      const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

      const { data, error } = await supabase
        .from('supported_languages')
        .select('id, code, name, native_name')
        .limit(5)

      if (error) {
        dbStatus = 'failed'
        errorMessage = error.message
      } else {
        dbStatus = 'success'
        languages = data ?? []
      }
    } catch (error) {
      dbStatus = 'failed'
      errorMessage =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.'
    }
  }

  const isEnvConnected = hasUrl && hasAnonKey
  const isDbConnected = dbStatus === 'success'

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Supabase 연결 확인</h1>

      <p>
        이 페이지는 Supabase 환경변수와 실제 데이터베이스 연결 상태를
        확인하는 테스트 페이지입니다.
      </p>

      <hr style={{ margin: '24px 0' }} />

      <h2>1. 환경변수 상태</h2>

      <ul>
        <li>
          NEXT_PUBLIC_SUPABASE_URL:{' '}
          <strong>{hasUrl ? '연결됨' : '없음'}</strong>
        </li>
        <li>
          NEXT_PUBLIC_SUPABASE_ANON_KEY:{' '}
          <strong>{hasAnonKey ? '연결됨' : '없음'}</strong>
        </li>
      </ul>

      {isEnvConnected ? (
        <p style={{ color: 'green', fontWeight: 'bold' }}>
          Supabase 환경변수 연결됨
        </p>
      ) : (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          Supabase 환경변수 연결 실패
        </p>
      )}

      <hr style={{ margin: '24px 0' }} />

      <h2>2. 데이터베이스 연결 상태</h2>

      {!isEnvConnected && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          환경변수가 없어서 DB 연결 테스트를 진행할 수 없습니다.
        </p>
      )}

      {isEnvConnected && isDbConnected && (
        <div>
          <p style={{ color: 'green', fontWeight: 'bold' }}>
            Supabase DB 연결 성공
          </p>

          <p>
            supported_languages 테이블에서 최대 5개 데이터를 정상적으로
            조회했습니다.
          </p>

          <h3>조회 결과</h3>

          {languages.length > 0 ? (
            <ul>
              {languages.map((language) => (
                <li key={language.id ?? language.code}>
                  {language.code} / {language.name} / {language.native_name}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              테이블 연결은 성공했지만 아직 표시할 언어 데이터가 없습니다.
            </p>
          )}
        </div>
      )}

      {isEnvConnected && dbStatus === 'failed' && (
        <div>
          <p style={{ color: 'red', fontWeight: 'bold' }}>
            Supabase DB 연결 실패
          </p>

          <p>아래 오류 메시지를 확인해 주세요.</p>

          <pre
            style={{
              padding: 16,
              backgroundColor: '#f5f5f5',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
            }}
          >
            {errorMessage}
          </pre>
        </div>
      )}
    </main>
  )
}