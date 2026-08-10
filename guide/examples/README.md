# TypeScript 경로 품질 분석 실습

`analyze_path.ts`는 Mousecrack의 `{x, y, t}` 결과를 읽어 구조와 timing을 검증하고 기초 path metric을 계산합니다. ONNX model, RobotJS와 실제 cursor control을 사용하지 않으므로 안전하게 실행할 수 있습니다.

## 실행

Node.js가 TypeScript type stripping을 지원할 때:

```bash
node --experimental-strip-types \
  guide/examples/analyze_path.ts \
  guide/examples/sample_path.json
```

지원하지 않는 Node에서는 TypeScript compiler로 임시 JavaScript를 만듭니다.

```bash
npx --prefix inference tsc guide/examples/analyze_path.ts \
  --target ES2022 \
  --module NodeNext \
  --moduleResolution NodeNext \
  --outDir .tmp-guide

node .tmp-guide/analyze_path.js guide/examples/sample_path.json
```

## 출력 metric

- Point·segment 수
- 전체 duration
- 직선거리와 실제 path length
- Path efficiency
- 평균·최대 segment speed
- 최대 jump와 마지막 jump
- Bounding box

## Validation

다음 경우 exit code `1`로 실패합니다.

- JSON root가 array가 아님
- Point가 두 개 미만
- `x`, `y`, `t`가 finite number가 아님
- 첫 timestamp가 0이 아님
- Timestamp가 증가하지 않음

이 도구는 목표 좌표나 실제 display boundary를 모르므로 호출 측에서 별도 검사해야 합니다.

## Mousecrack 결과 연결

현재 CLI는 JavaScript object 형태로 console 출력하므로 strict JSON pipeline을 위해 SDK에서 `JSON.stringify(await steps(...))`로 저장하는 방법을 권장합니다.

```js
import { writeFile } from 'node:fs/promises';
import { steps } from 'mousecrack';

const path = await steps({ x: 100, y: 200 }, { x: 500, y: 400 });
await writeFile('path.json', JSON.stringify(path, null, 2));
```

그 후:

```bash
node --experimental-strip-types guide/examples/analyze_path.ts path.json
```

## 확장 과제

1. `--width`, `--height`를 받아 screen boundary를 검증합니다.
2. Requested target을 받아 마지막 point가 일치하는지 확인합니다.
3. Velocity 변화로 acceleration과 jerk를 계산합니다.
4. 마지막 jump가 전체 path의 일정 비율보다 크면 실패시킵니다.
5. 여러 path의 median·p95를 집계해 Standard/Lite를 비교합니다.
