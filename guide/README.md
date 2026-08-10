# Mousecrack 한국어 학습 가이드

작성일: 2026-08-10

Mousecrack을 처음 설치해 실제 cursor를 움직이지 않고 경로를 생성하는 단계부터, LSTM+Mixture Density Network, ONNX 추론, 경로 품질 평가와 학습·배포 구조를 이해하는 단계까지 이어지는 학습 경로입니다.

## 학습 순서

1. [설치와 안전한 첫 실행](01_getting_started.md) — npm, native dependency, `steps()` 우선 검증, SDK·CLI
2. [LSTM·MDN과 경로 생성 원리](02_model_and_inference.md) — feature, sequence, mixture sampling, smoothing과 종료 조건
3. [SDK·CLI와 경로 품질 실습](03_sdk_cli_and_evaluation.md) — Standard/Lite, input validation, timing·distance·efficiency 분석
4. [학습·변환·고급 개발](04_training_and_development.md) — JSONL, TensorFlow, masked MDN loss, ONNX, test·성능·보안
5. [TypeScript 경로 분석기](examples/README.md) — model이나 cursor control 없이 sample path를 검증하고 metric 계산

## 한눈에 보는 실행 흐름

```text
시작 좌표 + 목표 좌표
  → [이전 dx, dy, dt, 남은 distX, distY]
  → 2-layer LSTM
  → 5-component MDN parameter
  → mixture·Gaussian sampling
  → 다음 [dx, dy, dt]
  → 목표 근접 또는 500 step까지 반복
  → 끝점 강제
  → move()만 X/Y smoothing 후 RobotJS로 실제 이동
```

## 핵심 용어

| 용어 | 의미 | 이 프로젝트에서의 역할 |
|---|---|---|
| Time series | 시간 순서가 중요한 값 sequence | mouse step의 변화량과 시간을 순차 예측 |
| LSTM | 장기 의존성을 다루는 recurrent network | 이전 전체 path를 반영해 다음 움직임 예측 |
| MDN | 여러 분포의 mixture parameter를 출력하는 network | 하나의 평균이 아닌 다양한 human-like trajectory sampling |
| Mixture component | 분포를 구성하는 개별 Gaussian | Gumbel-max로 component를 선택 |
| ONNX | model 교환·추론 format | TensorFlow weight를 Node.js ONNX Runtime에서 실행 |
| Path efficiency | 직선거리 / 실제 이동거리 | 과도한 우회와 진동을 탐지하는 기초 metric |
| Step latency | 연속 point의 누적 시간 차이 | 음수·0 timing과 급격한 delay 탐지 |

## 안전 원칙

- 자동화는 먼저 `steps()`로 경로만 생성해 검증합니다.
- `move()`는 명시적인 user action과 human approval 뒤에만 실행합니다.
- Screen boundary, 최대 이동거리, time limit와 비상 중단을 둡니다.
- CI·server·headless 환경에서는 실제 cursor 이동을 금지합니다.
- CAPTCHA 우회, click fraud, 무단 조작과 탐지 회피에 사용하지 않습니다.
- Agent skill에 mouse 권한을 줄 때 최소 권한과 대상 application allowlist를 적용합니다.

## 공식 자료

- [원본 README](../README.md)
- [한국어 README](../README_kor.md)
- [TypeScript SDK 구현](../inference/index.ts)
- [CLI 구현](../inference/cli.ts)
- [MDN sampling utility](../inference/util.ts)
- [학습 script](../train/train.py)
- [Move Mouse skill](../skills/move-mouse/SKILL.md)

프로젝트는 실험 단계입니다. Native dependency와 hardware/OS 지원은 실행 시점의 package metadata를 확인하세요.
