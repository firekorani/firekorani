// 공통 인증 헬퍼 — 다른 API 파일에서 import해서 사용
export async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const session = await env.DB.prepare(
    "SELECT s.user_id, s.expires_at, u.username, u.name, u.role, u.is_active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  )
    .bind(token)
    .first();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  if (session.is_active !== 1) return null;

  return session; // { user_id, username, name, role }
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
