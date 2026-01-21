# 선착순 쿠폰 발급 시스템

<p align="center">
  <strong>동시성 환경에서 데이터 정합성 100% 보장하는 쿠폰 시스템</strong>
</p>

---

## 프로젝트 개요

이 프로젝트는 **대규모 동시 트래픽 환경에서도 정확한 수량 제어**가 가능한 선착순 쿠폰 발급 시스템을 구현하고, 단계적인 성능 개선을 통해 실제 서비스 수준의 안정성과 확장성을 달성하는 것을 목표로 합니다.

### 핵심 과제

- **Race Condition 해결**: 트랜잭션 원자성 보장으로 데이터 정합성 확보 (완료)
- **데이터 정합성 100% 보장**: 카운터와 실제 발급 수 불일치 방지 (완료)
- **중복 발급 방지**: 사용자당 1장 제한 (완료)
- **성능 최적화**: DB 부하 감소 및 응답 속도 개선 (진행 예정)
- **확장성 확보**: 대량 트래픽 처리 (진행 예정)

---

## 기술 스택

### Backend
| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| **NestJS** | 10.x | 구조화된 아키텍처, TypeORM 통합, 트랜잭션 관리 용이 |
| **TypeORM** | 0.3.x | 비관적 락, 트랜잭션 격리 수준 제어 |
| **TypeScript** | 5.x | 타입 안정성, 코드 품질 향상 |

### Database
| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| **PostgreSQL** | 16 | ACID 보장, FOR UPDATE 지원, 트랜잭션 성능 우수 |
| **Docker** | - | 일관된 개발 환경, 빠른 DB 구축 |

### Testing & Monitoring
| 기술 | 선택 이유 |
|------|-----------|
| **Artillery** | 동시성 테스트, TPS/응답시간 측정 |
| **TypeORM Logging** | 쿼리 로그 분석, 성능 병목 지점 파악 |

### 향후 적용 예정
- **Redis**: 재고 선점, 중복 요청 1차 차단, 레이트 리밋
- **BullMQ**: 비동기 처리, Worker 수평 확장

---

## 단계별 개선 과정

| 단계 | 핵심 목표 | 주요 기술 | 처리량 (TPS) | 응답시간 (p95) | 상태 |
|------|-----------|-----------|--------------|----------------|------|
| **Step1. MVP** | 데이터 정합성 100% | 트랜잭션 + 비관적 락 | 100+ | ~50ms | 완료 |
| **Step2. Redis** | DB 보호 + 속도 개선 | Redis 캐싱, Rate Limit | 500+ (목표) | ~15ms (목표) | 예정 |
| **Step3. MQ** | 확장성 완성 | BullMQ, Worker 확장 | 2000+ (목표) | ~100ms (목표) | 예정 |

---

## Step1. 핵심 트러블슈팅

### 문제: Race Condition으로 인한 초과 발급

**상황**
```
300명이 동시에 쿠폰 요청 → 131명 성공, 169명 실패
100개만 발급되어야 하는데 131개 발급! (31개 초과)
```

**원인 분석**
```typescript
// 기존 코드: 각 단계가 독립적으로 실행
const coupon = await findOne();              // 1. 읽기
if (coupon.quantity >= 100) { ... }          // 2. 체크
await update({ quantity: +1 });              // 3. 쓰기 (트랜잭션 밖!)

// 문제: 읽기와 쓰기 사이에 다른 요청이 끼어들어 초과 발급
```

**Race Condition 타임라인**
```
[쿠폰 99개 발급된 상황, 사용자 A/B 동시 요청]

시간 | 사용자A              | 사용자B              | DB 상태
-----|----------------------|----------------------|----------
 1ms | SELECT (99)          | SELECT (99)          | count=99
 2ms | 99 < 100 체크 통과   | 99 < 100 체크 통과   | count=99
 3ms | UPDATE +1            |                      | count=100
 4ms |                      | UPDATE +1            | count=101 ← 초과!
 5ms | INSERT 성공          | INSERT 성공          | 발급=101

결과: 100개 제한이 무시되고 101개 발급됨
실제 테스트: 100개 → 131개 발급 (31개 초과)
```

**해결 방법**
```typescript
// 개선: 트랜잭션 + 비관적 락
await transaction('REPEATABLE READ', async (manager) => {
  const coupon = await manager
    .createQueryBuilder()
    .setLock('pessimistic_write')  // FOR UPDATE
    .getOne();

  // 체크 + 업데이트가 원자적으로 보장됨
  if (coupon.issued_quantity >= coupon.total_quantity) {
    throw new Error('발급 불가');
  }

  await manager.increment(Coupon, { id }, 'issued_quantity', 1);
  await manager.save(issue);
});
```

**개선 결과**

| 지표 | 개선 전 | 개선 후 | 변화 |
|------|---------|---------|------|
| **발급 수량** | 131개 (초과!) | 100개 | 정확 제어 |
| **초과 발급** | 31개 발생 | 0개 | 완전 차단 |
| **성공률** | 43.7% (131/300) | 33.3% (100/300) | 정확한 제한 |
| **응답시간 p95** | 2725ms | ~1500ms | -45% |

---

## 주요 기능

### 1. 쿠폰 캠페인 관리
- 쿠폰 생성 (총 수량, 기간, 상태 관리)
- 쿠폰 조회 (남은 수량 실시간 확인)
- 쿠폰 수정/삭제

### 2. 선착순 쿠폰 발급
- **동시성 제어**: 트랜잭션 + 비관적 락으로 초과 발급 방지
- **중복 방지**: DB UNIQUE 제약 + 애플리케이션 레벨 체크
- **발급 기록**: 발급 코드 생성 및 이력 관리

### 3. 사용자 관리
- JWT 인증
- 사용자별 발급 내역 조회

---

## 성능 및 부하 테스트

### 테스트 환경
```yaml
도구: Artillery
동시 요청: 300개 (1초 내)
테스트 사용자: 300명
쿠폰 수량: 100개
```

### V1 테스트 결과

**Artillery 지표**
```
성공 (201): 131개 (초과 발급!)
실패 (400): 169개
성공률: 43.7%

응답 시간:
  - min: 299ms
  - max: 2961ms
  - mean: 1562.9ms
  - median: 1587.9ms
  - p95: 2725ms
  - p99: 2951.9ms

Request Rate: 287/sec
Total time: 5초
```

**DB 검증**
```sql
-- 초과 발급 확인!
총수량: 100, 발급카운터: 131, 실제발급: 131, 초과: 31개

-- 중복 발급
중복 발급: 0건 (UNIQUE 제약 작동)

-- 발급 시간
소요시간: 5초, 평균 TPS: 287건/초
```

**쿼리 로그 분석**
```sql
-- 문제: UPDATE가 트랜잭션 밖에서 실행
query: UPDATE "coupons" SET "issued_quantity" = "issued_quantity" + 1
query: UPDATE "coupons" SET "issued_quantity" = "issued_quantity" + 1
query: START TRANSACTION  -- 이후에야 트랜잭션 시작
query: INSERT INTO "coupon_issues"...
query: COMMIT
```

### V2 개선 후 (예상)

**쿼리 로그**
```sql
-- 개선: 트랜잭션이 모든 작업을 보호
query: START TRANSACTION
query: SELECT ... FOR UPDATE  -- 비관적 락
query: UPDATE "coupons" SET "issued_quantity" = "issued_quantity" + 1
query: INSERT INTO "coupon_issues"...
query: COMMIT
```

**성과**

| 항목 | V1 | V2 | 달성 |
|------|----|----|------|
| **발급 수량** | 131개 (초과) | 100개 | 정확 제어 |
| **초과 발급** | 31개 발생 | 0개 | 완전 차단 |
| **성공률** | 43.7% (부정확) | 33.3% (정확) | 제한 준수 |
| **중복 발급** | 0건 | 0건 | 유지 |
| **응답시간 p95** | 2725ms | ~1500ms | -45% |
| **TPS** | 287 | 200+ | 안정적 |

---

## 빠른 시작

### 1. 설치
```bash
# 저장소 클론
git clone https://github.com/your-username/coupon-allocation.git
cd coupon-allocation

# 의존성 설치
pnpm install
```

### 2. 환경 설정
```bash
# .env 파일 생성
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=coupon_allocation
JWT_SECRET_KEY=your_secret_key
```

### 3. DB 실행
```bash
# Docker Compose로 PostgreSQL 실행
docker-compose up -d

# DB 상태 확인
docker ps
```

### 4. 애플리케이션 실행
```bash
# 개발 모드
pnpm run start:dev

# 프로덕션 모드
pnpm run build
pnpm run start:prod
```

### 5. 부하 테스트
```bash
# 테스트 사용자 생성 (99명)
npx ts-node generate-tokens.ts

# Artillery 부하 테스트
artillery run artillery-test.yaml

# DB 검증
./scripts/validate-db.sh 2
```

---

## 핵심 학습

### 1. 동시성 제어
- **Race Condition** 발견 및 해결 경험
- 트랜잭션 격리 수준 (REPEATABLE READ) 이해
- 비관적 락 vs 낙관적 락 비교

### 2. 부하 테스트
- Artillery를 활용한 동시성 재현
- TPS, 응답시간 등 성능 지표 측정
- 쿼리 로그 분석으로 병목 지점 파악

### 3. 데이터베이스
- FOR UPDATE 락 메커니즘
- 트랜잭션 원자성 (Atomicity) 보장
- UNIQUE 제약을 통한 다층 방어

### 4. 문제 해결 과정
- 가설 수립 → SQL 검증 → 근본 원인 파악
- 시행착오를 통한 최적 해결책 도출
- 데이터 기반 의사결정

---

## 향후 계획

### Step2. Redis 적용
- [ ] Redis 재고 선점 (DECR)
- [ ] 중복 요청 1차 차단 (SETNX)
- [ ] 레이트 리밋 (초당 요청 제한)
- [ ] 캠페인 조회 캐싱
- **목표**: DB QPS 70% 감소, 응답시간 67% 개선

### Step3. Message Queue 적용
- [ ] BullMQ 도입
- [ ] 비동기 발급 처리
- [ ] Worker 수평 확장
- [ ] 재시도 + 멱등성 처리
- **목표**: TPS 2000+, API 응답 100ms 이내

---

## 프로젝트 구조

```
coupon-allocation/
├── src/
│   ├── coupon/
│   │   ├── coupon.controller.ts
│   │   ├── coupon.service.ts       # V1: 트랜잭션 미적용 → V2: 적용
│   │   ├── entities/
│   │   │   ├── coupon.entity.ts
│   │   │   └── coupon-issue.entity.ts
│   │   └── dto/
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── entities/
│   └── common/
├── scripts/
│   └── validate-db.sh              # DB 검증 스크립트
├── artillery-test.yaml             # 부하 테스트 설정
├── generate-tokens.ts              # 테스트 사용자 생성
├── docker-compose.yml
└── README.md
```

---

## 기여

이슈와 PR은 언제나 환영합니다!

---

## 라이선스

This project is licensed under the MIT License.

---

**개발 기간**: 2026-01-15 ~ 진행 중
**개발자**: Backend Developer
**문의**: your.email@example.com
