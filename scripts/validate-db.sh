#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 쿠폰 발급 시스템 DB 검증 스크립트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 헤더 출력
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}쿠폰 발급 시스템 DB 검증${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Docker 컨테이너 확인
if ! docker ps | grep -q "coupon-postgres"; then
  echo -e "${RED}❌ PostgreSQL Docker 컨테이너가 실행 중이지 않습니다.${NC}"
  echo -e "${YELLOW}다음 명령어로 컨테이너를 시작하세요:${NC}"
  echo "  docker-compose up -d"
  exit 1
fi

echo -e "${GREEN}✅ PostgreSQL Docker 컨테이너 확인 완료${NC}"
echo ""

# 쿠폰 ID 입력받기
if [ -z "$1" ]; then
  COUPON_ID=2
  echo -e "${YELLOW}쿠폰 ID를 지정하지 않았습니다. 기본값 사용: ${COUPON_ID}${NC}"
else
  COUPON_ID=$1
  echo -e "${GREEN}검증할 쿠폰 ID: ${COUPON_ID}${NC}"
fi
echo ""

# 임시 파일 생성
TEMP_FILE=$(mktemp)

# 검증 쿼리 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. 데이터 정합성 검사${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
SELECT
  c.id as \"쿠폰ID\",
  c.name as \"쿠폰명\",
  c.total_quantity as \"총수량\",
  c.issued_quantity as \"발급카운터\",
  COUNT(ci.id) as \"실제발급건수\",
  c.issued_quantity - COUNT(ci.id) as \"차이\",
  CASE
    WHEN c.issued_quantity = COUNT(ci.id) THEN '일치'
    ELSE '불일치'
  END as \"정합성\"
FROM coupons c
LEFT JOIN coupon_issues ci ON ci.coupon_id = c.id
WHERE c.id = ${COUPON_ID}
GROUP BY c.id, c.name, c.total_quantity, c.issued_quantity;
" | tee -a "$TEMP_FILE"

echo ""

# 중복 발급 확인
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. 중복 발급 확인${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
DUPLICATES=$(docker exec coupon-postgres psql -U postgres -d coupon_allocation -t -c "
SELECT COUNT(*)
FROM (
  SELECT user_id, coupon_id
  FROM coupon_issues
  WHERE coupon_id = ${COUPON_ID}
  GROUP BY user_id, coupon_id
  HAVING COUNT(*) > 1
) as dup;
" | xargs)

if [ "$DUPLICATES" -eq 0 ]; then
  echo -e "${GREEN}✅ 중복 발급 없음${NC}"
else
  echo -e "${RED}❌ 중복 발급 ${DUPLICATES}건 발견${NC}"
  docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
  SELECT user_id as \"사용자ID\", COUNT(*) as \"발급횟수\"
  FROM coupon_issues
  WHERE coupon_id = ${COUPON_ID}
  GROUP BY user_id
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT 10;
  "
fi

echo ""

# 발급 통계
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. 발급 통계${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
SELECT
  COUNT(*) as \"총발급건수\",
  COUNT(DISTINCT user_id) as \"고유사용자수\",
  COUNT(*) - COUNT(DISTINCT user_id) as \"중복발급수\"
FROM coupon_issues
WHERE coupon_id = ${COUPON_ID};
"

echo ""

# 쿠폰 상태
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. 쿠폰 상태${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
SELECT
  id as \"쿠폰ID\",
  name as \"쿠폰명\",
  total_quantity as \"총수량\",
  issued_quantity as \"발급수량\",
  total_quantity - issued_quantity as \"남은수량\",
  ROUND(issued_quantity::numeric / total_quantity * 100, 2) as \"발급률(%)\",
  status as \"상태\"
FROM coupons
WHERE id = ${COUPON_ID};
"

echo ""

# 발급 시간 분석
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. 발급 시간 분석${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
SELECT
  MIN(created_at) as \"첫발급시간\",
  MAX(created_at) as \"마지막발급시간\",
  MAX(created_at) - MIN(created_at) as \"발급소요시간\",
  COUNT(*) as \"총발급건수\"
FROM coupon_issues
WHERE coupon_id = ${COUPON_ID};
"

echo ""

# 동시 발급 패턴
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. 동시 발급 패턴 (Top 10)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker exec coupon-postgres psql -U postgres -d coupon_allocation -c "
SELECT
  DATE_TRUNC('millisecond', created_at) as \"시간\",
  COUNT(*) as \"발급수\"
FROM coupon_issues
WHERE coupon_id = ${COUPON_ID}
GROUP BY DATE_TRUNC('millisecond', created_at)
ORDER BY COUNT(*) DESC
LIMIT 10;
"

echo ""

# 결과 요약
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}검증 결과 요약${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 데이터 정합성 체크
MISMATCH=$(docker exec coupon-postgres psql -U postgres -d coupon_allocation -t -c "
SELECT COUNT(*)
FROM (
  SELECT c.id
  FROM coupons c
  LEFT JOIN coupon_issues ci ON ci.coupon_id = c.id
  WHERE c.id = ${COUPON_ID}
  GROUP BY c.id, c.issued_quantity
  HAVING c.issued_quantity <> COUNT(ci.id)
) as mismatch;
" | xargs)

if [ "$MISMATCH" -eq 0 ]; then
  echo -e "${GREEN}✅ 데이터 정합성: 일치${NC}"
else
  echo -e "${RED}❌ 데이터 정합성: 불일치 발견${NC}"
fi

if [ "$DUPLICATES" -eq 0 ]; then
  echo -e "${GREEN}✅ 중복 발급: 없음${NC}"
else
  echo -e "${RED}❌ 중복 발급: ${DUPLICATES}건${NC}"
fi

# 초과 발급 체크
OVER_ISSUED=$(docker exec coupon-postgres psql -U postgres -d coupon_allocation -t -c "
SELECT COUNT(*)
FROM coupons
WHERE id = ${COUPON_ID} AND issued_quantity > total_quantity;
" | xargs)

if [ "$OVER_ISSUED" -eq 0 ]; then
  echo -e "${GREEN}✅ 초과 발급: 없음${NC}"
else
  echo -e "${RED}❌ 초과 발급: 발생${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}검증 완료${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}전체 검증 결과를 확인하려면:${NC}"
echo "  docker exec coupon-postgres psql -U postgres -d coupon_allocation -f docs/validation-queries.sql"
echo ""
echo -e "${YELLOW}결과를 파일로 저장하려면:${NC}"
echo "  $0 ${COUPON_ID} > validation-result.txt"
echo ""

# 임시 파일 삭제
rm -f "$TEMP_FILE"
