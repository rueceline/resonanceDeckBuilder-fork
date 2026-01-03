export type PatchNoteEntry = {
  date: string;
  title?: string;
  items: string[];
};

const patchNotes: PatchNoteEntry[] = [
  {
    date: "2026-01-03",
    title: "버리기 기능 오류 수정",
    items: [
      "덱 코드 생성 로직 변경",
      "편성 목록 추가"
    ],
  },
  {
    date: "2026-01-02",
    title: "기능 추가, Bug Fix",
    items: [
      "캐릭터 상세 정보 변경",
      "스킬, 공명 파생 스킬 표시",
      "생활 스킬 계산 수정",
      "덱 불러오기 버그 수정",
      "버리기 카드 기본 포함 처리",
      "KR, JP 번역 적용",
      "png -> webp"
    ],
  },
];

export default patchNotes;
