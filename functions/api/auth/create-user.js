// POST /api/auth/create-user  (관리자 전용 — 초기 세팅 시 또는 관리자 화면에서 사용)
// body: { username, password, name, role }
// 주의: 운영 적용 전 반드시 "이미 로그인한 관리자만 호출 가능"하도록 세션 검증 로직을 추가해야 함
//       (지금은 최초 관리자 계정을 만들기 위한 기초 버전)

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

export async function onRequestPost({ request, env }) {
  try {
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
