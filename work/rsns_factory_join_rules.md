## 1. 필터링 규칙 (고정)

### ❗ 유일한 필터 기준
- **BookFactory 기준만 사용**

```text
角色图鉴       → Unit 대상
角色装备图鉴   → Equipment 대상
```

### 적용 방식
- `BookFactory.idCN === "角色图鉴"`
  - `unitList[].id` → UnitFactory.id
- `BookFactory.idCN === "角色装备图鉴"`
  - `equipmentList[].id` → EquipmentFactory.id

⚠️ 그 외 어떤 필터(mod, idCN, 성별, 품질 등)도 적용하지 않는다.

---

## 2. 기본 원칙

- **모든 Factory의 기본 필드는 전부 유지**
- 이 문서에서는 오직 **조인 관계(ID 참조)** 만 정의
- VM은 **검증용**이므로
  - 가공 필드 없음
  - 파생 필드 없음 (계산·요약·의미 재해석으로 새로운 필드 생성 금지)
  - 원본 구조 유지

---

## 3. UnitFactory 조인 관계

### 3.1 Unit → SkillFactory

| UnitFactory 필드 | 타입 | 조인 대상 |
|---|---|---|
| `skillList[].skillId` | number | SkillFactory.id |
| `passiveSkillList[].skillId` | number | SkillFactory.id |
| `finalSkill` | number | SkillFactory.id |

---

### 3.2 Unit → TalentFactory

| 필드 | 타입 | 조인 |
|---|---|---|
| `talentList[].talentId` | number | TalentFactory.id |

---

### 3.3 Unit → BreakthroughFactory

| 필드 | 타입 | 조인 |
|---|---|---|
| `breakthroughList[].breakthroughId` | number | BreakthroughFactory.id |

---

### 3.4 Unit → HomeSkillFactory

| 필드 | 타입 | 조인 |
|---|---|---|
| `homeSkillList[].id` | number | HomeSkillFactory.id |

---

### 3.5 Unit → TagFactory

| 필드 | 설명 |
|---|---|
| `sideId` | 진영 태그 |
| `tagList[].tagId` | 캐릭터 태그 |
| `equipmentSlotList[].tagID` | 장비 슬롯 태그 |
| `classifyList[].des` | 분류 태그 |
| `careerList[].des` | 직업 태그 |

→ 전부 `TagFactory.id` 참조

---

### 3.6 Unit → 기타 Factory (검증용)

| 필드 | 조인 대상 |
|---|---|
| `growthId` | GrowthFactory.id |
| `fileList[].file` | ListFactory.id |
| `ProfilePhotoList[].id` | ProfilePhotoFactory.id |
| `viewId` | UnitViewFactory.id |
| `skinList[].unitViewId` | UnitViewFactory.id |

---

## 4. EquipmentFactory 조인 관계

### 4.1 Equipment → SkillFactory

| EquipmentFactory 필드 | 조인 |
|---|---|
| `skillList[].skillId` | SkillFactory.id |
| `disappearSkillList[].skillId` | SkillFactory.id |

---

### 4.2 Equipment → RandomSkill (List 경유)

| 필드 | 조인 흐름 |
|---|---|
| `randomSkillList[].skillId` | ListFactory.id → 내부 skillId → SkillFactory.id |

---

### 4.3 Equipment → TagFactory

| 필드 | 조인 |
|---|---|
| `equipTagId` | TagFactory.id |
| `campTagId` | TagFactory.id |

---

### 4.4 Equipment → GrowthFactory

| 필드 | 조인 |
|---|---|
| `growthId` | GrowthFactory.id |

---

## 5. SkillFactory 확장 조인

### 5.1 Skill → ExSkill (1-depth)

| 필드 | 조인 |
|---|---|
| `ExSkillList[].ExSkillName` | SkillFactory.id |

---

### 5.2 Skill → CardFactory

| 필드 | 조인 |
|---|---|
| `cardID` | CardFactory.id |

---

### 5.3 Skill → TagFactory

| 필드 |
|---|
| `specialTagList[]` |
| `campList[]` |

→ 전부 `TagFactory.id`

---

## 6. TalentFactory → Skill 확장

| TalentFactory 필드 | 조인 |
|---|---|
| `skillList[].skillId` | SkillFactory.id |
| `skillIntensify` | SkillFactory.id |
| `skillActiveUpgrade[].id` | SkillFactory.id |
| `skillParamOffsetList[].skillId` | SkillFactory.id |

---

## 7. CardFactory (역방향 검증)

| CardFactory 필드 | 조인 |
|---|---|
| `linkCardId[].Id` | CardFactory.id |
| `tagList[].tagId` | TagFactory.id |

---

## 8. VM 설계 결론

- 필터: **BookFactory만 사용 (절대 변경 금지)**
- Unit VM 포함 조인:
  - Skill / Talent / HomeSkill / Breakthrough / Tag
- Equipment VM 포함 조인:
  - Skill / RandomSkill(List) / Tag / Growth
- 모든 조인은 **숫자 ID 기반**
- VM은 **검증용** → 보기 쉽게 중첩, 로직 최소화

---

※ 이 문서는 build_db / build_vm 수정 시 기준 문서로 사용한다.

