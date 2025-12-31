# Resonance DeckBuilder 통합 개발 계획

> 목적: **Astro 폐지 → React/Next.js/Vercel 통일**, 덱빌더 루트 유지, DB/Asset 단일 소스(SSOT)로 통합

---

## 0. 요약(Executive Summary)

* 프레임워크: **Next.js(App Router)** 단일화
* 배포: **Vercel**
* 데이터/에셋: **`public/data`, `public/assets` 단일 소스**
* Firebase: **제거**(부가 기능)
* Astro: **완전 폐지**, 기존 기능은 **Next 페이지로 재개발**
* DB 규모: **약 7MB** → 당장은 유지, 추후 **인덱스 분리** 고려

---

## 1. 전제 조건(확정)

* 원본 프로젝트: `resonanceDeckBuilder-main` (Next/React/Tailwind)
* 현재 DB 로딩: 클라이언트에서 `/data/...json` fetch
* Astro 페이지 기능 범위: **DB 읽기, 리스트 출력, 검색, 정렬**
* 외부 링크 사용 금지 → **public asset으로 대체**

---

## 2. 최종 스택(확정)

* **Next.js (App Router)**
* **Vercel**
* 정적 자산: `public/` 기준 서빙
* 데이터 접근 기본값: **정적 JSON**

---

## 3. 핵심 설계 원칙

### 3.1 Single Source of Truth (SSOT)

* DB와 에셋은 단 하나의 위치에서만 관리

```
public/
  data/
  assets/
```

* 덱빌더/리스트 페이지/상세 페이지 **모두 동일 경로 사용**

### 3.2 정규화 레이어로 스키마 변경 흡수

* UI는 원본 DB 구조에 직접 의존하지 않음
* `normalize/adapter` 계층에서 구조 변경을 흡수
* 목표: **DB 변경 시 UI 수정 최소화**

### 3.3 덱빌더 루트 유지

* 프로젝트 루트는 덱빌더
* Astro 관련 파일/빌드/의존성 **미사용**

---

## 4. 개발 단계(Phase)

### Phase 0 — 베이스라인 고정

**목적:** 원본 상태가 정상 동작함을 기준점으로 확보

* fork 후 로컬 실행/빌드/배포 성공 확인
* 코드/DB 변경 없음

### Phase 1 — Firebase 제거

**목적:** 외부 의존성 제거, 환경 단순화

* Firebase SDK/초기화/환경변수 제거
* 댓글/공유 기능: 제거 또는 localStorage 대체
* 덱빌더 핵심 기능 유지

### Phase 2 — DB 업데이트(내용 교체)

<!-- 참고자료: DB 생성/조인 로직 요약 (build_db_extracted.js 기준) -->
#### 참고자료: build_db_extracted.js 조인 로직 요약

이 문단은 `db.zip`이 구버전이고 `Factory.json`이 최신버전인 상황에서도, **구버전 DB 생성 조건을 최신 Factory에 매칭**할 때 “조건이 모두 참”이 되도록 하기 위한 **조인/의존 관계 정리**이다.  
DB 생성 스크립트를 수정하거나 DB 스키마를 변경할 때, 아래 관계를 함께 갱신해야 한다.

##### 1) Factory → *_db.json 생성 단계(대부분 참조 ID 보존)

- `char_db.json` (원본: `UnitFactory.json`)
  - 포함 조건: `isUnitIncludedByCoreFilter(unitRec)`로 필터링
  - 조인 방식: **조인하지 않고 참조 ID/리스트를 그대로 저장**(런타임에서 조인)
    - `skillList[].skillId` → `SkillFactory.id` (참조)
    - `passiveSkillList[]` → 스킬 참조 성격(필드 구조 보존)
    - `talentList[]` → `TalentFactory.id` 참조 성격(구조 보존)
    - `breakthroughList[]` → `BreakthroughFactory.id` 참조 성격(구조 보존)
    - `homeSkillList[]` → `HomeSkillFactory.id` 참조 성격(구조 보존)
    - `equipmentSlotList[]` → 장비 슬롯 정의(구조 보존)

- `equip_db.json` (원본: `EquipmentFactory.json`)
  - 포함 조건: `isEquipmentIncludedByCoreFilter(equipRec)`로 필터링
  - 조인 방식
    - `skillList[].skillId` → `SkillFactory.id` (참조만 보존)
    - `equipTagId` → `TagFactory.id` (참조만 보존)
    - `Getway[]`는 구조 유지, 단 `Getway[i].DisplayName`은 토큰화(언어 파일로 분리)

- `skill_db.json` (원본: `SkillFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 방식
    - `cardID` → `CardFactory.id` (참조만 보존)
    - `ExSkillList[]`는 원본 구조 그대로 저장(확장 조인은 Map 생성 단계에서 수행)
    - `desParamList`, `skillParamList`는 구조 그대로 저장

- `card_db.json` (원본: `CardFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 방식: `tagList[]`, `ExCondList[]`, `ExActList[]` 등 원본 구조 보존(런타임 처리)

- `tag_db.json` (원본: `TagFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 없음(축약 필드만 저장)

- `talent_db.json` (원본: `TalentFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 방식: `skillParamOffsetList[]` 구조 보존(조인 없음)

- `break_db.json` (원본: `BreakthroughFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 방식: `attributeList[]` 구조 보존(조인 없음)

- `home_skill_db.json` (원본: `HomeSkillFactory.json`)
  - 포함 조건: 없음(전체)
  - 조인 없음(축약 필드만 저장)

##### 2) Map 생성 단계(여기서만 실제 조회/확장 조인 수행)

- `char_skill_map.json`
  - 입력: `char_db.json` + `SkillFactory(id→record map)`
  - 생성 규칙
    - `skills`: `char_db[charId].skillList[].skillId`를 수집(중복 제거)
    - `relatedSkills`: 위 `skills`의 각 스킬을 `SkillFactory`에서 조회하여 `ExSkillList`를 **1-depth 확장**해 수집(중복 제거)
    - `notFromCharacters`: 현재 스크립트는 빈 배열(자리만 유지)

- `item_skill_map.json`
  - 입력: `equip_db.json` + `SkillFactory(id→record map)`
  - 생성 규칙(현재 스크립트는 “superset” 방식)
    - `equip_db[equipId].skillList[].skillId` 각각을 `SkillFactory`에서 조회
    - 각 스킬의 `ExSkillList`를 **1-depth 확장**해 `relatedSkills`로 수집
    - `relatedSkills`가 비어있지 않으면 `item_skill_map[equipId] = { relatedSkills }`

##### 3) 언어(토큰화) 조인 규칙

- 문자열 필드는 DB에 원문을 직접 넣지 않고 **토큰(token)** 으로 치환하여 저장한다.
- 토큰 생성: `${prefix}_${id}_${pathParts...}` 형태
- 언어 파일 생성:
  - `lang_cn[token] = cnText`
  - `lang_ko[token] = tr(ConfigLanguage, factoryName, fieldName, cnText)`  
    (KR 번역은 `ConfigLanguage.json`을 “factoryName + fieldName + cnText” 기준으로 조회해 매칭)

- 토큰화 적용 필드(스크립트 기준)
  - UnitFactory: `name`, `identity`, `ability`
  - EquipmentFactory: `name`, `des/description`, `Getway[*].DisplayName`
  - SkillFactory: `name`, `description`, `detailDescription`, `leaderCardConditionDesc`
  - CardFactory: `name`
  - TagFactory: `tagName`, `detail`
  - TalentFactory: `name`, `desc`
  - BreakthroughFactory: `name`, `desc`
  - HomeSkillFactory: `name`, `desc`

##### 4) 스키마 수정 시 같이 갱신해야 하는 곳

- 캐릭터/장비 DB에 새 참조 필드를 추가/변경:
  - 해당 `build*Db()` 함수 수정(대부분 Map은 영향 없음)
- 스킬 관계(ExSkillList 처리) 규칙 변경:
  - `pickExSkillIds()` 및 `buildCharSkillMap()` / `buildItemSkillMap()` 수정
- 토큰 키 포맷/토큰 prefix 변경:
  - `makeLangCollector().tok()` 및 기존 `lang_*.json` 호환성(마이그레이션) 검토
- Tag 등 “전체 수록이 부담”하여 필터 추가:
  - `buildTagDb()`에 필터를 추가하되, 런타임 조회 실패 가능성도 함께 점검

**목적:** 기능 영향 없이 데이터만 교체

* `_db.json` 최신화
* 스키마/필드 유지

### Phase 3 — DB 구조 수정(스키마 변경)

**목적:** 장기 유지보수 구조 정리

* 스키마 변경 허용
* UI 직접 수정 금지
* **정규화 레이어에서만 흡수**

### Phase 4 — Astro 기능의 Next 재개발

**목적:** Astro 완전 제거

* 캐릭터/장비 등 리스트 페이지를 Next로 신규 구현
* 서버 컴포넌트: 초기 데이터 로드
* 클라이언트 컴포넌트: 검색/정렬/상호작용

### Phase 5 — 메인 페이지 통합

**목적:** 사용자 진입 구조 정리

* `/` 메인 허브
* 덱빌더/DB 페이지 링크 통합

---

## 5. DB 로딩 전략(결정 보류)

* 현재: 단일 `_db.json`(~7MB) 클라이언트 fetch
* 문제 인식: 초기 로딩/중복 파싱 비용
* 후보:

  * **정적 인덱스 분리**(리스트용 최소 필드)
  * 상세는 필요 시 로드
* 결정 시점: Phase 3 이후

---

## 6. 제외 범위(의도적 미실시)

* 성능 최적화 조기 적용
* 서버 fs 전면 전환
* API Route 재설계

---

## 7. 체크리스트(진행 관리)

* [ ] Phase 0 완료
* [ ] Phase 1 완료
* [ ] Phase 2 완료
* [ ] Phase 3 완료
* [ ] Phase 4 완료
* [ ] Phase 5 완료

---

## 8. 요약

* **Astro 폐지**
* **Next/Vercel 통일**
* **DB/Asset 단일 소스**
* **단계별 진행으로 혼선 방지**
