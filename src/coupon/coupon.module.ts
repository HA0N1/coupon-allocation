import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { Coupon } from './entities/coupon.entity';
import { CouponIssue } from './entities/coupon-issue.entity';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, CouponIssue]), UserModule],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService, TypeOrmModule],
})
export class CouponModule {}
