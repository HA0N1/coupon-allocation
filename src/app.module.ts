import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CouponModule } from './coupon/coupon.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [CouponModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
