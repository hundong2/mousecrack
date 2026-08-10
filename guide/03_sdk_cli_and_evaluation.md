# 03. SDK·CLI와 경로 품질 실습

## 목표

SDK와 CLI의 contract를 안전하게 사용하고, path가 단순히 목표에 도달했는지를 넘어 시간·거리·효율·jump를 정량 평가합니다.

## 1. API contract

```ts
interface Position {
  x: number;
  y: number;
}

interface Step {
  x: number;
  y: number;
  t: number;
}
```

```ts
steps(start: Position, end: Position, type?: ModelType): Promise<Step[]>
move(x: number, y: number, type?: ModelType): Promise<void>
```

`steps()`는 path를 반환하고 `move()`는 현재 OS cursor 위치를 읽어 생성·smoothing·sleep·이동을 수행합니다.

## 2. CLI 입력 검증 주의

현재 CLI는 Commander가 받은 문자열을 unary `+`로 number 변환하고 model map을 조회합니다. 다음 입력은 호출 측 wrapper에서 먼저 차단하세요.

- 숫자가 아닌 값과 `NaN`, `Infinity`
- 음수 또는 display 바깥 좌표
- 허용하지 않은 model 문자열
- 지나치게 먼 이동과 긴 duration
- GUI session이 없는 환경

Unknown model은 map lookup 결과가 `undefined`가 되어 SDK의 default Standard로 fallback할 수 있습니다. 오타를 조용히 허용하지 않도록 명시적인 enum validation을 추가하는 편이 안전합니다.

## 3. Standard와 Lite 비교

같은 start/end를 여러 번 sampling해 다음을 비교합니다.

- model session load 포함·제외 latency
- path generation latency
- step 수와 전체 duration
- path efficiency
- 마지막 jump와 maximum jump
- 목표 주변 overshoot 횟수
- 경로 다양성

확률 모델이므로 단 한 번의 결과가 아니라 충분한 반복의 median과 p95를 봅니다. Warm-up 뒤 latency를 측정하고 session cache가 재사용되는지 구분하세요.

## 4. 경로 metric

연속 point 거리:

```text
d_i = sqrt((x_i-x_(i-1))² + (y_i-y_(i-1))²)
```

전체 거리와 효율:

```text
path_length = Σ d_i
straight_distance = distance(first, last)
efficiency = straight_distance / path_length
```

Efficiency는 0~1에 가까우며 1이면 직선입니다. 사람과 유사한 경로는 반드시 1일 필요가 없지만 너무 낮으면 과도한 우회·진동 가능성이 있습니다.

속도:

```text
speed_i = d_i / ((t_i - t_(i-1)) / 1000)
```

0ms interval과 negative time은 invalid로 처리합니다. Pixel/s는 physical speed가 아니며 DPI와 display scaling에 영향을 받습니다.

## 5. TypeScript 분석기

```bash
node --experimental-strip-types \
  guide/examples/analyze_path.ts \
  guide/examples/sample_path.json
```

Node version이 type stripping을 지원하지 않으면 프로젝트 compiler로 JavaScript를 만든 뒤 실행하세요.

```bash
npx --prefix inference tsc guide/examples/analyze_path.ts \
  --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --outDir .tmp-guide
node .tmp-guide/analyze_path.js guide/examples/sample_path.json
```

임시 output은 검증 후 삭제합니다. 분석기는 실제 cursor를 움직이거나 ONNX model을 load하지 않습니다.

## 6. 운영 gate 예시

```text
step count <= 500
duration <= product-specific timeout
all t monotonic
all points within approved display rectangle
max jump <= threshold
last jump <= stricter threshold
target matches requested point
human approval present
```

Threshold는 arbitrary number가 아니라 실제 사용자 path와 failure data로 정합니다. 장애가 발생하면 원본 start/end, model, generated path, display geometry와 package version을 함께 기록하되 화면 내용이나 개인정보는 수집하지 마세요.

다음으로 [04. 학습·변환·고급 개발](04_training_and_development.md)을 진행하세요.
