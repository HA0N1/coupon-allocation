import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Coupon } from './coupon.entity';

@Entity('coupon_issues')
@Unique(['coupon_id', 'user_id'])
@Index(['coupon_id'])
@Index(['user_id'])
export class CouponIssue {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  issue_code: string;

  @Column({ type: 'boolean', default: false })
  is_used: boolean;

  @Column()
  user_id: number;

  @Column()
  coupon_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.couponIssues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Coupon, (coupon) => coupon.issues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;
}
