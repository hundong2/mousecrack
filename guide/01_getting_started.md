# 01. 설치와 안전한 첫 실행

## 목표

Package를 설치하고 실제 cursor 이동 없이 `steps()`로 첫 경로를 생성한 뒤, 검증을 통과한 경우에만 제한된 환경에서 `move()`를 사용합니다.

## 1. 요구사항

- Node.js와 npm
- ONNX Runtime Node가 지원하는 OS/architecture
- RobotJS native module을 build하거나 설치할 수 있는 toolchain
- GUI session과 mouse control 권한(`move()` 사용 시에만)

RobotJS는 native addon이므로 compiler, Python, system library가 필요할 수 있습니다. Headless server나 CI에서는 설치·실행이 제한될 수 있습니다.

## 2. Global CLI 설치

```bash
npm i -g mousecrack
mousecrack --help
mousecrack --version
```

Supply-chain risk를 줄이려면 설치 전에 package publisher, version, integrity와 dependency를 검토하고 production에서는 검증한 version을 고정하세요.

## 3. 경로만 생성

```bash
mousecrack steps 100 200 200 400 standard
```

이 명령은 시작점과 목표점 사이의 `{x, y, t}` 배열을 생성하지만 cursor를 움직이지 않습니다. `t`는 누적 millisecond입니다.

검사 항목:

- 첫 point가 요청한 시작점인가?
- 마지막 point가 목표점인가?
- 모든 좌표와 시간이 유한한 숫자인가?
- `t`가 감소하지 않는가?
- 중간 point가 screen boundary를 벗어나지 않는가?
- 마지막 강제 이동이 비정상적으로 크지 않은가?
- 전체 duration과 step 수가 제한 안에 있는가?

## 4. SDK

```bash
npm install mousecrack
```

```js
import { ModelType, steps } from 'mousecrack';

const path = await steps(
  { x: 100, y: 200 },
  { x: 200, y: 400 },
  ModelType.STANDARD,
);

console.log(path);
```

실제 이동을 호출하는 `move()`보다 `steps()`를 domain logic과 분리하면 path validation, preview, audit와 user confirmation을 넣기 쉽습니다.

## 5. 실제 이동 전 wrapper

실제 서비스에서는 다음 gate를 별도 deterministic code로 구현하세요.

```text
입력 숫자·범위 검사
  → 현재 display geometry 확인
  → steps() 경로 생성
  → path metric·boundary 검사
  → 대상 application·window 확인
  → human approval
  → 짧은 timeout과 emergency stop을 둔 move
```

Mousecrack의 `move()`는 내부적으로 다시 경로를 sampling하므로, 미리 본 `steps()` 경로와 실제 이동 경로가 같다고 가정하면 안 됩니다. 동일한 경로를 preview 후 재생해야 한다면 SDK에 검증된 path 실행 API를 별도로 설계해야 합니다.

## 6. Source build

```bash
cd inference
npm ci
npm run typecheck
npm run build
```

`npm ci`는 `package-lock.json`과 정확히 일치하는 dependency를 설치합니다. Build 결과는 `dist/`에 생성되고 ONNX asset도 bundle 과정에서 복사됩니다.

## 7. 문제 해결

### RobotJS 설치 실패

지원 Node ABI, compiler toolchain과 OS별 native dependency를 확인합니다. 너무 새로운 Node version에서는 prebuilt binary가 없을 수 있습니다.

### ONNX model을 찾지 못함

Package build의 public asset 복사와 `dist/model.onnx`, `dist/model_lite.onnx` 존재 여부를 확인합니다.

### `steps` 출력이 목표에서 크게 튐

Model이 500 step 안에 3 pixel threshold에 도달하지 못해 마지막 목표 point가 강제 추가됐을 수 있습니다. 마지막 jump와 total step을 metric으로 확인하세요.

### 실제 cursor가 예상과 다른 위치로 이동

Multi-monitor origin, DPI scaling, remote desktop, display resolution과 OS accessibility permission을 확인합니다.

다음으로 [02. LSTM·MDN과 경로 생성 원리](02_model_and_inference.md)를 진행하세요.
