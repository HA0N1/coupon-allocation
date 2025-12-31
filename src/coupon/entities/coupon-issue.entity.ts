export class CouponIssue {
  id: bigint;
  issue_code: string;
  is_used: boolean;
  user_id: bigint;
  coupon_id: bigint;
  created_at: Date;
  updated_at: Date;
}
