import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Coupon } from './entities/coupon.entity';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  create(createCouponDto: CreateCouponDto) {
    const coupon = {
      name: createCouponDto.name,
      status: 'OPEN',
      totalQuantity: createCouponDto.totalQuantity,
      issuedQuantity: +0,
    };

    return this.couponRepository.save(coupon);
  }

  findAll() {
    return this.couponRepository.find();
  }

  findOne(id: number) {
    return this.couponRepository.findOne({ where: { id } });
  }

  update(id: number, updateCouponDto: UpdateCouponDto) {
    return this.couponRepository.update(id, updateCouponDto);
  }

  remove(id: number) {
    return this.couponRepository.delete(id);
  }

  createIssue(id: number) {
    console.log(id);
  }
}
