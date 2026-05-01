export default function SupabaseDebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const hasUrl = Boolean(supabaseUrl)
  const hasAnonKey = Boolean(supabaseAnonKey)
  const isConnected = hasUrl && hasAnonKey

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Supabase 연결 확인</h1>

      <p>
        이 페이지는 Supabase 환경변수가 정상적으로 연결되었는지 확인하는
        테스트 페이지입니다.
      </p>

      <hr style={{ margin: '24px 0' }} />

      <h2>환경변수 상태</h2>

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

      <hr style={{ margin: '24px 0' }} />

      {isConnected ? (
        <div>
          <h2 style={{ color: 'green' }}>Supabase 환경변수 연결됨</h2>
          <p>이제 Supabase 클라이언트를 연결할 준비가 되었습니다.</p>
        </div>
      ) : (
        <div>
          <h2 style={{ color: 'red' }}>Supabase 환경변수 연결 실패</h2>
          <p>
            .env.local 또는 Vercel Environment Variables에 값이 제대로
            들어갔는지 확인해 주세요.
          </p>
        </div>
      )}
    </main>
  )
}