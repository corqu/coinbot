# AutoTrading Frontend

React + TypeScript + Vite 기반의 프론트엔드입니다.

## 시작

```bash
npm install
npm run dev
```

## API 통합 페이지

기본 라우트(`/`)에 모든 백엔드 API를 한 번에 호출해볼 수 있는 통합 페이지가 있습니다.

- Auth API 전체
- Strategy API 전체
- 요청/응답 로그 확인

## 재사용 방식

다른 페이지에서 API를 재사용할 때는 아래 모듈만 import 하면 됩니다.

```ts
import { authApi, strategyApi } from "@/features/api";
```

예시:

```ts
await authApi.signIn({ email, password });
const strategies = await strategyApi.getActiveStrategies();
```

## 실시간 차트 WebSocket

메인 페이지 차트는 Python 서버의 WebSocket(`/ws/market`)을 구독합니다.

- 기본 연결 주소: `ws://localhost:8001/ws/market`
- 필요 시 `.env`에서 커스텀:

```bash
VITE_PYTHON_WS_BASE=ws://localhost:8001
```

## 폴더 구조

```text
src/
  app/
  components/
  features/
    auth/
    strategy/
    api.ts      # 통합 export
  lib/
  pages/
  stores/
```
