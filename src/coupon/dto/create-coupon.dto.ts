export class CreateCouponDto {
  name: string;
  status: string; // e.g., 'OPEN', 'CLOSED'
  totalQuantity: number;
}
