import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CouponIssue } from './coupon-issue.entity';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int' })
  total_quantity: number;

  @Column({ type: 'int', default: 0 })
  issued_quantity: number;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  ends_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CouponIssue, (issue) => issue.coupon)
  issues: CouponIssue[];
}
