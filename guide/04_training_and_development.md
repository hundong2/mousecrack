# 04. 학습·변환·고급 개발

## 목표

Training data contract, masked MDN loss와 ONNX export를 이해하고 reproducibility, test, 성능, 보안과 배포를 개선합니다.

## 1. 저장소 구조

| 경로 | 역할 |
|---|---|
| `inference/index.ts` | ONNX session cache, autoregressive path 생성, SDK `steps`·`move` |
| `inference/util.ts` | softplus, Gaussian·mixture sampling, smoothing, sleep |
| `inference/cli.ts` | Commander 기반 CLI |
| `inference/config.ts` | dimension, component, delay와 model path |
| `inference/public/*.onnx` | npm package에 포함되는 추론 model |
| `train/train.py` | JSONL parsing, LSTM+MDN 학습과 weight 저장 |
| `train/convert.py` | TensorFlow model weight를 ONNX로 변환 |
| `train/data.jsonl` | mouse trajectory 학습 data |
| `skills/move-mouse` | agent용 CLI 사용 지침 |

## 2. Data contract

각 JSONL record에는 최소한 target과 path가 필요합니다.

```json
{
  "target": {"x": 200, "y": 400},
  "path": [
    {"x": 100, "y": 200, "timestamp": 0},
    {"x": 105, "y": 204, "timestamp": 12}
  ]
}
```

학습 전 다음을 검증하세요.

- 최소 두 point
- 모든 coordinate·timestamp가 finite
- Timestamp 단조 증가
- 비현실적 jump와 delay
- Target과 실제 마지막 point 차이
- Duplicate·corrupt record
- User/session별 train-validation leakage
- 개인정보나 화면 내용이 dataset에 포함되지 않음

## 3. 학습

현재 script는 data 전체를 memory에 load하고 padding합니다.

```bash
cd train
python train.py
```

Python dependency와 version은 별도 lockfile에 고정하는 것이 좋습니다. TensorFlow, TensorFlow Probability, `tf_keras`, NumPy와 CUDA 조합은 compatibility matrix를 확인하세요.

개선 후보:

- Dataset streaming과 bucketed batching으로 padding·memory 감소
- Feature normalization과 `dt` scale 조정
- User/session group split
- Random seed와 environment 기록
- Early stopping과 best validation checkpoint
- Gradient clipping, NaN monitoring
- Standard/Lite architecture를 config로 일원화
- Calibration set에서 path-level metric 평가

## 4. MDN loss 검증

Padding mask가 모든 output dimension과 일치하는지, 빈 sequence가 들어오지 않는지 확인합니다. `log_prob`은 underflow를 피하도록 distribution implementation을 사용하며 loss가 NaN이면 input scale, invalid `dt`, 너무 작은 variance와 learning rate를 점검합니다.

Frame-level negative log-likelihood가 낮아도 전체 autoregressive path가 좋다는 보장은 없습니다. 작은 prediction error가 누적되므로 rollout evaluation이 필요합니다.

## 5. ONNX 변환

```bash
cd train
python convert.py
```

변환 후 반드시 TensorFlow와 ONNX Runtime의 같은 input에 대한 raw MDN parameter를 비교합니다.

- Output shape `[1, T, 35]`
- 최대·평균 absolute error
- Dynamic sequence length
- Padding mask behavior
- Standard/Lite weight와 output filename 대응
- Node runtime에서 model asset load

Sampling random 차이를 제거하기 위해 distribution parameter를 먼저 비교하고, 동일 RNG를 주입할 수 있을 때 path distribution을 비교합니다.

## 6. TypeScript 검증

```bash
cd inference
npm ci
npm run typecheck
npm run build
```

추가할 가치가 큰 test:

- `softplus`의 큰 양수·음수 안정성
- 0 또는 1에 가까운 RNG에서 Box–Muller/Gumbel finite 여부
- MDN parameter offset과 output dimension
- Smoothing의 첫·마지막 point 및 timestamp 보존
- Invalid CLI 숫자·model 거부
- Max step 종료와 마지막 jump 표시
- Injected RNG를 사용한 deterministic snapshot
- Mocked RobotJS로 실제 cursor를 움직이지 않는 `move` test

## 7. 성능

현재 autoregressive loop는 매 step마다 전체 sequence tensor를 다시 구성하고 LSTM을 처음부터 실행합니다. 긴 path에서 allocation과 계산량이 증가합니다.

개선 시 측정할 항목:

- ONNX session cold start와 warm inference 분리
- Tensor allocation과 copy
- Sequence length별 step latency
- Stateful hidden/cell input-output model
- Standard/Lite의 도달 step 수
- Smoothing과 RobotJS sleep을 포함한 end-to-end latency

최적화는 같은 dataset·seed 가능한 harness에서 path distribution과 quality가 유지되는지 확인한 뒤 적용합니다.

## 8. 보안과 책임 있는 사용

- Mouse control은 user가 보는 GUI session과 명시적인 승인으로 제한합니다.
- Password manager, terminal, admin UI 등 민감 window에서는 비활성화합니다.
- Agent가 임의 coordinate를 직접 전달하지 못하게 semantic action allowlist를 둡니다.
- Emergency stop, maximum action count와 timeout을 제공합니다.
- Plugin·npm package update는 review와 version pin 뒤에 배포합니다.
- CAPTCHA, 광고 click, game bot, 무단 remote control과 detection evasion에 사용하지 않습니다.
- Dataset 수집 시 informed consent, retention과 deletion policy를 적용합니다.

## 9. 다음 학습 경로

1. [TypeScript 경로 분석기](examples/README.md)에 boundary와 acceleration metric을 추가합니다.
2. `Math.random()`을 injectable RNG interface로 바꿔 unit test를 작성합니다.
3. CLI input schema와 명확한 error message를 추가합니다.
4. Stateful LSTM ONNX export를 실험하고 benchmark합니다.
5. Path-level held-out evaluation과 Standard/Lite 비교 report를 만듭니다.
