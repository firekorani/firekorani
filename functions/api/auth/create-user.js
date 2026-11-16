// POST /api/auth/create-user  (관리자 전용)
// 호출 시 반드시 헤더에 Authorization: Bearer <로그인토큰> 을 포함해야 함
// body: { username, password, name, role }

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getAdminFromRequest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const session = await env.DB.prepare(
    "SELECT s.user_id, s.expires_at, u.role, u.is_active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  )
    .bind(token)
    .first();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  if (session.is_active !== 1) return null;
  if (session.role !== "admin") return null;

  return session;
}

export async function onRequestPost({ request, env }) {
  try {
    const admin = await getAdminFromRequest(request, env);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: "관리자 권한으로 로그인한 상태에서만 계정을 생성할 수 있습니다." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { username, password, name, role } = await request.json();

    if (!username || !password || !name || !role) {
      return new Response(JSON.stringify({ error: "모든 항목을 입력하세요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!["admin", "office", "inspector"].includes(role)) {
      return new Response(JSON.stringify({ error: "역할 값이 올바르지 않습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    const passwordHash = `${salt}:${hash}`;

    await env.DB.prepare(
      "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)"
    )
      .bind(username, passwordHash, name, role)
      .run();

    await env.DB.prepare(
      "INSERT INTO audit_logs (user_id, action, detail) VALUES (?, 'create_user', ?)"
    )
      .bind(admin.user_id, `신규 계정 생성: ${username} (${role})`)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "서버 오류: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
