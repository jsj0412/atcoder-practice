# AtCoder Practice

AtCoder Problems의 공개 데이터로 가상 연습을 생성하고 BOJ 형식의 스코어보드를 보여 주는 공유 웹앱입니다.

## 공유 DB 설정 (필수)

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [supabase-schema.sql](./supabase-schema.sql)의 내용을 한 번 실행합니다.
3. Dashboard의 **Connect**에서 Project URL과 **Publishable key**를 복사합니다.
4. [config.js](./config.js)의 `url`, `publishableKey`에 각각 붙여 넣습니다. `secret key`는 절대 넣지 마세요.

연습 설정과 선정 문제는 Supabase에 저장됩니다. 연습 화면의 **공유 링크** 버튼으로 복사한 URL을 열면, 다른 브라우저에서도 같은 연습과 스코어보드를 볼 수 있습니다.

## 실행

`start.bat`을 더블 클릭한 뒤 브라우저로 `http://localhost:4173`을 여세요. 실행 창은 닫지 마세요.

Node.js가 있다면 프로젝트 폴더에서 아래를 실행해도 됩니다.

```powershell
node server.js
```

`server.ps1`/`server.js`는 정적 파일을 제공하고 AtCoder Problems API를 중계하므로, 브라우저 CORS 문제 없이 동작합니다. 기본 실행인 `start.bat`은 Windows PowerShell만 사용하므로 Node.js 설치가 필요 없습니다.

## 제공 기능

- 시작/종료 시각, 참가자 ID, 난이도 구간, 문제 수 입력
- 문제 배치: 무작위 또는 난이도 순 정렬
- 참가자 전원의 과거 제출 이력이 있는 문제 제외
- 연습 시간 중 제출을 기준으로 한 ICPC/BOJ식 풀이 수·페널티 스코어보드
- Supabase에 연습 설정·선정 문제를 공유 저장
- URL로 같은 연습을 열고 공유 링크 복사

AtCoder Problems API는 비공식 API입니다. 운영 서비스로 확장할 때에는 서버 캐시, 요청 제한, DB 동기화 작업을 두어야 합니다.
