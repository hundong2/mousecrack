# 02. LSTM·MDN과 경로 생성 원리

## 목표

Mouse movement를 time series로 표현하는 방법, LSTM이 history를 사용하는 방식과 MDN sampling이 경로 다양성을 만드는 원리를 이해합니다.

## 1. Feature 설계

Frame `i`에서 다음 입력을 사용합니다.

```text
x_i = [dx_(i-1), dy_(i-1), dt_(i-1), target_x - x_i, target_y - y_i]
```

Target은 다음 변화량입니다.

```text
y_i = [dx_i, dy_i, dt_i]
```

절대 screen coordinate 대신 변화량과 목표까지의 상대 거리를 사용하면 다양한 시작 위치에 같은 movement pattern을 적용하기 쉬워집니다. 하지만 screen size, scaling과 device 특성은 feature에 직접 들어가지 않아 domain shift가 생길 수 있습니다.

## 2. Sequence와 LSTM

추론 구현은 생성된 모든 이전 step을 매번 `[1, sequenceLength, 5]` tensor로 만들어 LSTM에 다시 전달합니다. 마지막 time step의 출력 parameter만 사용합니다.

장점:

- 이전 속도와 방향을 반영한 연속성
- 고정 길이 window 없이 전체 history 사용

비용:

- Step이 늘수록 매 iteration의 sequence가 길어짐
- 전체 생성 계산량이 대략 quadratic하게 증가할 수 있음
- Lite가 step inference는 빨라도 더 자주 이탈하면 end-to-end가 느려질 수 있음

Stateful recurrent inference로 hidden state를 재사용하면 계산을 줄일 수 있지만 ONNX model interface와 동등성 검증이 필요합니다.

## 3. Mixture Density Network

하나의 next step 평균만 예측하면 서로 다른 자연스러운 방향이 평균화되어 부자연스러운 움직임이나 mode collapse가 생길 수 있습니다. MDN은 여러 Gaussian component의 weight, mean과 scale을 출력합니다.

현재 설정:

```text
component 수 K = 5
output dimension D = 3  # dx, dy, dt
parameter 수 = K × (1 + 2D) = 35
```

각 component는 mixture logit 하나, 세 mean과 세 scale parameter를 가집니다.

## 4. Sampling

1. Mixture logit에 Gumbel noise를 더해 component를 선택합니다.
2. Scale parameter에 softplus를 적용해 양수 standard deviation을 만듭니다.
3. Box–Muller transform으로 각 dimension의 Gaussian sample을 생성합니다.
4. `dt <= 0`이면 최소 delay 2ms로 clamp합니다.

`Math.random()`을 사용하므로 같은 입력도 결과가 달라집니다. 현재 public API에는 seed 주입이 없어 regression test가 어렵습니다. 개발 시 injectable RNG를 도입하면 sampling unit test와 재현성을 개선할 수 있습니다.

## 5. 종료와 끝점 강제

다음 중 하나면 generation loop를 종료합니다.

- 목표까지 Euclidean distance가 3 pixel 미만
- 500 step 소진

이후 목표 좌표를 마지막 point로 무조건 추가합니다. 따라서 마지막 jump가 매우 크더라도 결과상 목표에는 도달합니다. 다음 metric을 함께 확인하세요.

- 마지막 jump distance
- 최대 step distance
- total steps
- actual distance / straight distance
- screen boundary violation

## 6. Smoothing

`move()`는 raw path의 X/Y에 기본 window size 7의 centered moving average를 적용합니다. 첫·마지막 point와 각 point의 `t`는 보존합니다.

Smoothing은 작은 jitter를 줄이지만 다음 문제가 있습니다.

- Constraint 또는 장애물 경계를 넘어설 수 있음
- 같은 timestamp에서 좌표만 바뀌어 실제 속도 profile이 달라짐
- Sharp turn을 둔화함

따라서 smoothing 뒤의 최종 path를 다시 boundary와 velocity 기준으로 검사해야 합니다.

## 7. 학습 loss

Training data의 길이가 다르므로 `-999999.0`으로 padding하고 mask를 만듭니다. MDN의 negative log-likelihood를 실제 frame에만 합산합니다.

```text
loss = -Σ mask × log p([dx,dy,dt] | history, target distance)
       / (Σ mask + 1e-8)
```

Validation split은 10%, 기본 epoch는 200, batch size는 64입니다. Random path-level train/validation split에서 동일 사용자나 session pattern이 양쪽에 섞이면 성능이 과대평가될 수 있으므로 group split을 권장합니다.

## 실습 질문

1. 왜 absolute `(x, y)` 대신 remaining distance를 사용하는가?
2. Component 수를 늘리면 다양성·학습 안정성·추론 비용은 어떻게 변하는가?
3. `dx`, `dy`, `dt`의 scale 차이가 loss에 주는 영향은 무엇인가?
4. 마지막 목표 강제가 success rate를 과장할 수 있는 이유는 무엇인가?
5. Stateful LSTM inference가 결과를 바꾸지 않는지 어떻게 검증할 것인가?

다음으로 [03. SDK·CLI와 경로 품질 실습](03_sdk_cli_and_evaluation.md)을 진행하세요.
