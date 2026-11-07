# 📈 토스 증권 자산 대시보드 (TossStock Cloud Dashboard)

- **배포 주소**: [https://ryu1127.github.io/toss-stock-dashboard/](https://ryu1127.github.io/toss-stock-dashboard/)
- **연동 가계부**: [https://ryu1127.github.io/asset-dashboard-private/](https://ryu1127.github.io/asset-dashboard-private/)

## 아키텍처
- **정적 호스팅 (GitHub Pages)**: 서버나 비밀 키 없이 브라우저에서 직접 동작하는 React + TypeScript + Vite 웹앱입니다.
- **Google Identity Services (Browser OAuth) + Google Sheets API v4**:
  - 저장소 코드에는 개인 자산 데이터가 전혀 포함되어 있지 않습니다.
  - 브라우저에서 구글 계정으로 로그인하면 `TossStock` 백엔드가 백업해둔 비공개 구글 스프레드시트(`14G8JY2nvRpXHlvuT4-EfZeaTEZLsHaqcgzAFIQcO19A`)의 10개 탭(`[혜신]` · `[동헌]` 일별자산 / 보유종목 / 매매이력 / 입출금 / 배당)을 `values:batchGet`으로 즉시 불러옵니다.
  - 동일한 `ryu1127.github.io` 도메인과 OAuth Client ID를 공유하므로 `asset-dashboard-private`에서 로그인한 세션 토큰(`driveToken`)이 그대로 호환됩니다.
