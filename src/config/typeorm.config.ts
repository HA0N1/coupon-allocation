import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from '../user/entities/refresh-token.entity';
import { Coupon } from '../coupon/entities/coupon.entity';
import { CouponIssue } from '../coupon/entities/coupon-issue.entity';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'coupon_allocation',
  entities: [User, RefreshToken, Coupon, CouponIssue],
  synchronize: process.env.NODE_ENV !== 'production', // 개발 중에만 true
  logging: process.env.NODE_ENV !== 'production',
};
