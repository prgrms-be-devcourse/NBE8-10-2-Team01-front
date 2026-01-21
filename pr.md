# PR Summary

이번 PR은 기술 블로그 글 작성용 `/write` 페이지를 추가하고,
리치 에디터/코드 하이라이팅/코드 블럭 UI를 포함한 편집 경험을 구현했습니다.
또한 서버 렌더링용 마크다운 유틸을 보강했습니다.

---

## 1) Markdown Editor (/write)

### 목적
- 좌측 편집, 우측 미리보기
- 코드 블럭 하이라이팅
- 코드 블럭 상단에 언어 라벨 + 복사 버튼(미리보기)
- 자동 괄호 페어, 중복 닫힘 방지, 들여쓰기 보정

### 파일 위치
- `app/write/page.tsx`
- 스타일: `app/globals.css`

### 주요 기능
- TipTap + StarterKit 기반 리치 에디터
- Lowlight 코드 하이라이팅
- 코드 블럭 상단 오버레이 UI
  - 입력: 언어 라벨
  - 미리보기: 언어 라벨 + 복사 버튼
- 자동 페어/들여쓰기 처리
  - `{` 후 Enter → `}\n` 정렬 유지
  - 괄호/따옴표 자동 완성 및 중복 방지

---

## 2) 코드 하이라이팅/복사

### 로직
- 입력 에디터와 미리보기 모두 동일한 TipTap extensions 사용
- 미리보기에서만 복사 버튼 노출

### 관련 파일
- `app/write/page.tsx`
- `app/globals.css`

---

## 3) 마크다운 유틸

### 목적
- 서버에서 마크다운을 HTML로 렌더링할 수 있도록 공통 유틸 제공

### 파일 위치
- `lib/markdown.ts`

### 제공 함수
| 함수 | 파라미터 | 반환 | 설명 |
| --- | --- | --- | --- |
| markdownToHtml | (markdown, options?) | string | HTML 문자열 |
| renderMarkdown | (markdown) | string | 서버 렌더용 HTML |

### 사용 예시
```ts
import { renderMarkdown } from "@/lib/markdown";

const html = renderMarkdown(markdownString);
```

---

## 4) 변경 파일 요약

- `app/write/page.tsx` (에디터/미리보기 화면)
- `app/globals.css` (에디터/코드 블럭 스타일)
- `lib/markdown.ts` (서버 렌더 유틸 추가)
- `package.json`, `package-lock.json` (tiptap/lowlight 의존성)

---

## 5) QA 체크리스트

- [ ] `/write`에서 입력/미리보기 동기화 확인
- [ ] 코드 블럭 하이라이팅 확인
- [ ] 코드 블럭 복사 버튼 동작 확인
- [ ] `{` + Enter 들여쓰기 보정 확인
- [ ] 괄호/따옴표 자동완성/중복 방지 확인

---

## 6) 스크린샷

- [ ] /write 전체 화면
- [ ] 코드 블럭 + 언어 라벨
- [ ] 코드 블럭 복사 버튼

