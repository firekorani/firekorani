// POST /api/auth/login
// body: { username, password }
// Cloudflare Pages Functions — D1 바인딩 이름은 "DB"로 가정 (Pages 설정에서 연결 필요)

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "아이디와 비밀번호를 입력하세요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await env.DB.prepare(
      "SELECT id, username, password_hash, name, role, is_active FROM users WHERE username = ?"
    )
      .bind(username)
      .first();

    if (!user || user.is_active !== 1) {
      return new Response(JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // password_hash 형식: "salt:hash"
    const [salt, storedHash] = user.password_hash.split(":");
    const inputHash = await hashPassword(password, salt);

    if (inputHash !== storedHash) {
      return new Response(JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일

    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    )
      .bind(token, user.id, expiresAt)
      .run();

    await env.DB.prepare(
      "INSERT INTO audit_logs (user_id, action, detail) VALUES (?, 'login', ?)"
    )
      .bind(user.id, `${user.username} 로그인`)
      .run();

    return new Response(
      JSON.stringify({
        token,
        user: { id: user.id, username: user.username, name: user.name, role: user.role },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "서버 오류: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
