import { requireAuth, unauthorized } from "../../_lib/auth.js";

// GET /api/clients?q=검색어&region=지역&grade=등급
export async function onRequestGet({ request, env }) {
  const user = await requireAuth(request, env);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const region = url.searchParams.get("region") || "";
  const grade = url.searchParams.get("grade") || "";

  let sql = `SELECT id, name, address, region, building_use, grade,
                    relation_person, manager_staff_id, monthly_check_staff_id,
                    last_inspection_date, next_inspection_date, inspection_status
             FROM clients WHERE is_active = 1`;
  const binds = [];

  if (q) {
    sql += ` AND (name LIKE ? OR address LIKE ?)`;
    binds.push(`%${q}%`, `%${q}%`);
  }
  if (region) {
    sql += ` AND region = ?`;
    binds.push(region);
  }
  if (grade) {
    sql += ` AND grade = ?`;
    binds.push(grade);
  }
  sql += ` ORDER BY name ASC LIMIT 200`;

  const stmt = env.DB.prepare(sql).bind(...binds);
  const { results } = await stmt.all();

  return new Response(JSON.stringify({ clients: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/clients  — 거래처 신규 등록
export async function onRequestPost({ request, env }) {
  const user = await requireAuth(request, env);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name) {
      return new Response(JSON.stringify({ error: "거래처명은 필수입니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fields = [
      "name", "address", "region", "building_use", "grade",
      "total_floor_area", "floor_count", "relation_person", "relation_phone",
      "safety_manager_name", "safety_manager_phone",
      "manager_staff_id", "monthly_check_staff_id",
      "last_inspection_date", "next_inspection_date", "inspection_status", "memo",
    ];
    const values = fields.map((f) => (body[f] !== undefined ? body[f] : null));

    const result = await env.DB.prepare(
      `INSERT INTO clients (${fields.join(",")}, created_by)
       VALUES (${fields.map(() => "?").join(",")}, ?)`
    )
      .bind(...values, user.user_id)
      .run();

    await env.DB.prepare(
      "INSERT INTO audit_logs (user_id, action, target_table, target_id, detail) VALUES (?, 'create', 'clients', ?, ?)"
    )
      .bind(user.user_id, String(result.meta.last_row_id), `거래처 등록: ${body.name}`)
      .run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
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
