import { BadRequestException, Inject, Injectable, LoggerService } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Coupon } from './entities/coupon.entity';
import { UserService } from 'src/user/user.service';
import { CouponIssue } from './entities/coupon-issue.entity';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponIssue)
    private readonly couponIssueRepo: Repository<CouponIssue>,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  create(createCouponDto: CreateCouponDto) {
    const coupon = {
      name: createCouponDto.name,
      status: 'OPEN',
      total_quantity: createCouponDto.totalQuantity,
      issued_quantity: +0,
    };

    return this.couponRepo.save(coupon);
  }

  findAll() {
    return this.couponRepo.find();
  }

  findOne(id: number) {
    return this.couponRepo.findOne({ where: { id } });
  }

  update(id: number, updateCouponDto: UpdateCouponDto) {
    return this.couponRepo.update(id, updateCouponDto);
  }

  remove(id: number) {
    return this.couponRepo.delete(id);
  }

  async createIssue(id: number, user: any) {
    const existUser = await this.userService.findById(user.userId);

    return await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const coupon = await manager
        .createQueryBuilder(Coupon, 'coupon')
        .where('coupon.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!coupon) {
        throw new BadRequestException('존재하지 않는 쿠폰입니다.');
      }

      // 2. 수량 체크
      if (coupon.status !== 'OPEN' || coupon.issued_quantity >= coupon.total_quantity) {
        throw new BadRequestException('발급 가능한 쿠폰이 없습니다.');
      }

      // 3. 중복 발급 체크
      const existingIssue = await manager.findOne(CouponIssue, {
        where: { coupon: { id }, user: { id: existUser.id } },
      });

      if (existingIssue) {
        throw new BadRequestException('이미 발급받은 쿠폰입니다.');
      }

      // 4. 수량 증가
      await manager.increment(Coupon, { id }, 'issued_quantity', 1);

      // 5. 발급 기록 생성
      const issue = manager.create(CouponIssue, {
        coupon: { id },
        user: { id: existUser.id },
      });
      await manager.save(issue);

      return {
        message: '쿠폰이 발급되었습니다.',
        issueCode: issue.issue_code,
      };
    });
  }

  private async checkExistingIssue(couponId: number, userId: number): Promise<boolean> {
    const existingIssue = await this.couponIssueRepo.findOne({
      where: { coupon: { id: couponId }, user: { id: userId } },
    });

    return !!existingIssue;
  }
}
