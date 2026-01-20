import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

    try {
      // 트랜잭션 시작
      // 쿠폰 존재 확인 및 남은 수량 체크
      // 사용자가 이미 쿠폰을 발급받았는지 확인
      // coupon 테이블에서 issuedQuantity 증가
      // coupon issue 테이블에 발급 기록 생성
      // 트랜잭션 커밋

      // 트랜잭션 없이 구현
      const existCoupon = await this.couponRepo.findOne({ where: { id } });
      if (!existCoupon) throw new BadRequestException('존재하지 않는 쿠폰입니다.');

      if (existCoupon.status !== 'OPEN' || existCoupon.issued_quantity >= existCoupon.total_quantity) {
        throw new BadRequestException('발급 가능한 쿠폰이 없습니다.');
      }
      const checkExistingIssue = await this.checkExistingIssue(id, existUser.id);

      if (checkExistingIssue) {
        throw new BadRequestException('이미 발급받은 쿠폰입니다.');
      }
      await this.couponRepo.update(id, { issued_quantity: () => 'issued_quantity + 1' });
      const coupon = this.couponIssueRepo.create({ coupon: { id: existCoupon.id }, user: { id: existUser.id } });

      await this.couponIssueRepo.save(coupon);

      return '쿠폰이 발급되었습니다.';
    } catch (error) {
      throw error;
    }
  }

  private async checkExistingIssue(couponId: number, userId: number): Promise<boolean> {
    const existingIssue = await this.couponIssueRepo.findOne({
      where: { coupon: { id: couponId }, user: { id: userId } },
    });

    return !!existingIssue;
  }
}
