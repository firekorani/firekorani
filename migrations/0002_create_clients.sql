-- 거래처 테이블
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                      -- 거래처명
  address TEXT,                            -- 주소
  region TEXT,                             -- 지역(구/군 등, 검색용으로 별도 저장)
  building_use TEXT,                       -- 건축물 용도
  grade TEXT,                              -- 소방안전관리대상물 등급 (특급/1급/2급/3급 등)
  total_floor_area REAL,                   -- 연면적(㎡)
  floor_count INTEGER,                     -- 층수
  relation_person TEXT,                    -- 관계인 정보
  relation_phone TEXT,
  safety_manager_name TEXT,                -- 소방안전관리자 정보
  safety_manager_phone TEXT,
  manager_staff_id INTEGER,                -- 담당 직원 (users.id 참조)
  monthly_check_staff_id INTEGER,          -- 월점검 담당자 (users.id 참조)
  last_inspection_date TEXT,               -- 최근 점검일
  next_inspection_date TEXT,               -- 다음 점검 예정일
  inspection_status TEXT DEFAULT '대기',    -- 점검 진행 상태 (대기/진행중/완료 등)
  memo TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_region ON clients(region);
CREATE INDEX IF NOT EXISTS idx_clients_grade ON clients(grade);
