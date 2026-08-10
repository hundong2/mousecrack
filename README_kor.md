<p align="center">
    <img src="https://github.com/puffinsoft/mousecrack/raw/master/assets/banner.png" width="400" alt="Mousecrack 배너" />
</p>

<p align="center">
자연스럽게 변화하는 사람과 유사한 mouse movement를 합성합니다.
</p>

<p align="center">
이 프로젝트는 deep learning의 mouse imitation 능력을 시험합니다.
</p>

<p align="center">
<strong>언어:</strong> <a href="README.md">English</a> | <a href="README_kor.md">한국어</a> · <a href="guide/README.md">한국어 학습 가이드</a>
</p>

## 목차

- [설치](#설치)
- [사용법](#사용법)
- [모델 선택](#모델-선택)
- [작동 원리](#작동-원리)
- [안전과 한계](#안전과-한계)
- [라이선스](#라이선스)

## 설치

```bash
npm i -g mousecrack
```

소스에서 개발하려면:

```bash
cd inference
npm ci
npm run typecheck
npm run build
```

## 사용법

> [!WARNING]
> 이 프로젝트는 아직 실험 단계이며 교육 목적으로만 제공됩니다.

개발자용 SDK와 agent용 CLI를 제공합니다.

### SDK

```js
import { move, steps } from 'mousecrack';

// 현재 cursor를 (200, 400)으로 이동합니다.
await move(200, 400);

// 실제 cursor를 움직이지 않고 이동 경로만 생성합니다.
const from = { x: 100, y: 200 };
const to = { x: 200, y: 400 };
const path = await steps(from, to);
```

`steps()` 결과는 다음 형태의 배열입니다.

```js
[
  { x: 100, y: 200, t: 0 },
  { x: 95, y: 202, t: 10.528131778472712 },
  { x: 90, y: 210, t: 21.040190062833986 },
  // ...
]
```

`t`는 시작 이후 누적 millisecond입니다. 실제 자동화 전에 `steps()`로 경로와 timing을 먼저 검사하는 것이 안전합니다.

### CLI

```bash
# 실제 cursor 이동
mousecrack move 200 400

# 시작점에서 목표점까지의 경로만 출력
mousecrack steps 100 200 200 400
```

CLI의 숫자 인자는 screen coordinate입니다. 현재 구현은 입력 범위와 model 이름을 엄격히 검증하지 않으므로 호출 측에서 유한한 숫자, screen boundary와 허용 이동 거리를 확인하세요.

### Agent Skill 설치

Claude Code:

```text
/plugin marketplace add puffinsoft/mousecrack
/plugin install move-mouse@mousecrack
```

Codex:

```text
codex plugin marketplace add puffinsoft/mousecrack
codex plugin add move-mouse@mousecrack
```

Agent에 mouse control 권한을 부여하기 전에 화면의 민감 정보, destructive click, multi-monitor coordinate, DPI scaling과 human approval 경계를 검토하세요.

## 모델 선택

다양한 hardware를 지원하기 위해 두 모델을 제공합니다.

| 모델 | 구조 | 장점 | 주의점 |
|---|---|---|---|
| Standard | 2×128 LSTM | 기본 권장, 목표에서 벗어나는 빈도가 상대적으로 낮음 | 추론 자체는 Lite보다 느림 |
| Lite | 2×64 LSTM | 평균 inference 약 29% 단축 | 이탈이 잦아 전체 생성 시간이 최대 8배 길 수 있음 |

CLI:

```bash
mousecrack move 200 400 lite
mousecrack steps 100 200 200 400 standard
```

SDK:

```js
import { ModelType, move, steps } from 'mousecrack';

await move(200, 400, ModelType.LITE);
await steps(from, to, ModelType.LITE);
```

Hardware가 강제하지 않는 한 Lite는 권장되지 않습니다. “한 step inference가 빠름”과 “목표까지 전체 경로 생성이 빠름”은 다른 지표입니다.

## 작동 원리

Mousecrack은 mouse path prediction을 multivariate time-series forecasting으로 다룹니다.

각 step의 model 입력은 다음 다섯 값입니다.

```text
[이전 dx, 이전 dy, 이전 dt, 목표까지 남은 distX, 목표까지 남은 distY]
```

출력은 다음 step의 변화량입니다.

```text
[dx, dy, dt]
```

두 LSTM layer가 전체 이전 sequence를 처리하고 Mixture Density Network(MDN)가 여러 가능한 다음 움직임의 확률 분포를 출력합니다. 단일 평균 경로만 예측할 때 발생할 수 있는 mode collapse를 줄이고 같은 시작·종료점에도 다양한 경로를 sampling합니다.

TypeScript 추론은 ONNX Runtime을 사용합니다. Mixture component는 Gumbel-max 방식으로 선택하고, 선택된 Gaussian의 평균·표준편차에서 Box–Muller 방식으로 변화량을 sampling합니다. 목표까지 거리가 3 pixel 미만이거나 최대 500 step에 도달하면 loop를 끝내며 마지막 point는 목표 좌표로 강제합니다. `move()`는 7-point sliding average로 X/Y를 smoothing한 뒤 RobotJS로 cursor를 이동합니다.

학습부는 Python/TensorFlow를 사용하며 Standard 모델은 두 개의 128-unit LSTM, Lite 모델은 더 작은 LSTM을 사용합니다. Padding mask가 적용된 sequence를 학습하고 TensorFlow Probability의 mixture distribution으로 negative log-likelihood를 최적화한 뒤 ONNX로 변환합니다.

## 안전과 한계

- 확률적 sampling을 사용하므로 같은 입력도 경로와 시간이 달라집니다.
- `steps()`는 끝점을 강제하므로 “목표 도달”만으로 중간 경로 품질을 판단할 수 없습니다.
- 최대 500 step 이후 목표점으로 크게 점프할 가능성을 검사해야 합니다.
- 현재 `Math.random()` 기반이라 seed를 통한 완전한 재현을 제공하지 않습니다.
- `move()`는 실제 OS cursor를 제어합니다. 테스트와 CI에서는 `steps()`만 사용하세요.
- CAPTCHA 우회, click fraud, 무단 system 조작이나 탐지 회피 목적으로 사용하지 마세요.
- 실제 화면 좌표는 multi-monitor, scaling, remote desktop과 display 변화에 영향을 받습니다.
- RobotJS와 ONNX Runtime은 native dependency이므로 Node/OS 조합에 따라 설치 문제가 생길 수 있습니다.

자세한 설치, 내부 구조와 실습은 [한국어 학습 가이드](guide/README.md)를 참고하세요.

## 라이선스

Mousecrack은 [MIT License](LICENSE)로 배포되는 open source software입니다.

---

> 이 문서는 원본 [README.md](README.md)의 한국어 번역입니다. Package version과 native dependency 지원 범위는 바뀔 수 있으므로 실행 시점의 npm metadata와 원본 저장소를 다시 확인하세요.
