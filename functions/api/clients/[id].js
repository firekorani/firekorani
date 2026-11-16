import { requireAuth, unauthorized } from "../../_lib/auth.js";

// GET /api/clients/:id — 거래처 상세 조회
export async function onRequestGet({ request, env, params }) {
  const user = await requireAuth(request, env);
  if (!user) return unauthorized();

  const client = await env.DB.prepare(
    "SELECT * FROM clients WHERE id = ? AND is_active = 1"
  )
    .bind(params.id)
    .first();

  if (!client) {
    return new Response(JSON.stringify({ error: "거래처를 찾을 수 없습니다." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ client }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// PUT /api/clients/:id — 거래처 정보 수정
export async function onRequestPut({ request, env, params }) {
  const user = await requireAuth(request, env);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const fields = [
      "name", "address", "region", "building_use", "grade",
      "total_floor_area", "floor_count", "relation_person", "relation_phone",
      "safety_manager_name", "safety_manager_phone",
      "manager_staff_id", "monthly_check_staff_id",
      "last_inspection_date", "next_inspection_date", "inspection_status", "memo",
    ];
    const setClauses = [];
    const binds = [];
    for (const f of fields) {
      if (body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        binds.push(body[f]);
      }
    }
    if (setClauses.length === 0) {
      return new Response(JSON.stringify({ error: "수정할 내용이 없습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    setClauses.push("updated_at = datetime('now')");
    binds.push(params.id);

    await env.DB.prepare(
      `UPDATE clients SET ${setClauses.join(", ")} WHERE id = ?`
    )
      .bind(...binds)
      .run();

    await env.DB.prepare(
      "INSERT INTO audit_logs (user_id, action, target_table, target_id, detail) VALUES (?, 'update', 'clients', ?, ?)"
    )
      .bind(user.user_id, params.id, `거래처 정보 수정 (id=${params.id})`)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "서버 오류: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// DELETE /api/clients/:id — 실제 삭제 대신 비활성화 처리 (데이터 보존)
export async function onRequestDelete({ request, env, params }) {
  const user = await requireAuth(request, env);
  if (!user) return unauthorized();
  if (user.role !== "admin") {
    return new Response(JSON.stringify({ error: "관리자만 삭제할 수 있습니다." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare("UPDATE clients SET is_active = 0 WHERE id = ?")
    .bind(params.id)
    .run();

  await env.DB.prepare(
    "INSERT INTO audit_logs (user_id, action, target_table, target_id, detail) VALUES (?, 'deactivate', 'clients', ?, '거래처 비활성화')"
  )
    .bind(user.user_id, params.id)
    .run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
