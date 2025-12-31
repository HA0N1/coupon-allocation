export class Coupon {
  id: bigint;
  name: string;
  total_quantity: number;
  issued_quantity: number;
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
