# Resonance 덱 빌더 (Resonance Deck Builder)

![image](https://github.com/user-attachments/assets/1d967fb9-da06-4b69-a360-d180f51a330a)<!-- 원한다면 스크린샷 이미지 추가 -->

📌 웹사이트 | Website: https://rsns-deck-builder.vercel.app/

---

## 🇰🇷 소개 (Korean)

**Resonance** 게임의 덱 구성을 도와주는 웹 애플리케이션입니다.  
게임에서 복사한 덱 코드를 붙여넣고 편집하거나, 새로운 덱을 구성해 다시 게임에 적용해보세요.

### 🔧 주요 기능

- **덱 코드 불러오기**  
  클립보드에 복사한 게임 내 덱 코드를 불러올 수 있습니다.

- **덱 코드 내보내기**  
  편집한 덱을 클립보드로 복사해 게임에 적용할 수 있습니다.

- **덱 공유 기능**  
  구성한 덱을 URL 링크로 쉽게 공유할 수 있습니다.

- **스크린샷 버튼**  
  버튼을 누르면 덱 화면을 자동으로 스크린샷 저장합니다.

- **초기화**  
  현재 작성 중인 덱을 전부 초기화합니다. 초기화된 내용은 되돌릴 수 없습니다.

- **로컬 저장 / 불러오기**  
  브라우저에 덱 프리셋을 저장하거나 불러올 수 있습니다.

- **언어 설정**  
  다양한 언어(KO/EN/JP/CN/TW)를 지원합니다.

---

## 🇺🇸 Introduction (English)

A web application that helps you build and manage your decks for the game **Resonance**.  
Import deck codes copied in-game, edit them on the site, and export them back into the game.

### 🔧 Key Features

- **Import from Clipboard**  
  Load a deck code copied from the game.

- **Export to Clipboard**  
  Copy your edited deck as a code usable in-game.

- **Deck Sharing via URL**  
  Share your custom deck with others using a unique URL.

- **Screenshot Button**  
  Automatically capture and save a screenshot of your deck.

- **Reset Deck**  
  Clears the current deck. This action cannot be undone.

- **Save / Load Locally**  
  Save your deck presets to your browser or load them later.

- **Language Support**  
  Supports multiple languages (Korean, English, Japanese, Simplified/Traditional Chinese).

## ⚙️ Tech Stack

![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=white&style=flat)
![Next.js](https://img.shields.io/badge/-Next.js-000000?logo=next.js&logoColor=white&style=flat)
![Tailwind CSS](https://img.shields.io/badge/-TailwindCSS-06B6D4?logo=tailwind-css&logoColor=white&style=flat)
![Vercel](https://img.shields.io/badge/-Vercel-000000?logo=vercel&logoColor=white&style=flat)
![Firebase](https://img.shields.io/badge/-Firebase-FFCA28?logo=firebase&logoColor=white&style=flat)

---

## 💻 개발 환경

### 브랜치

- `deploy`: 프로덕션 환경  

### 실행 환경

- Node.js: `18`
- 패키지 매니저: `npm`

---

## 🔗 배포

### Vercel

- `deploy` 브랜치로 커밋 시 자동으로 **프로덕션 환경**에 배포됩니다.

### Firebase Firestore

- Firebase Firestore를 댓글 데이터를 관리합니다.

---

## 🧪 향후 계획 (TODO)

- DB 업데이트
- DB public/assets 구조로 변경

---

## 📝 라이선스

This project is licensed under the [GNU General Public License v3.0](./LICENSE).  
See the LICENSE file for more information.
