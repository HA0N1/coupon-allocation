import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<String> {
    const { email, password } = createUserDto;

    const existUser = await this.findByEmail(email);
    if (existUser) throw new BadRequestException('이미 존재하는 유저입니다.');

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({ email, password: hashedPassword });
    await this.userRepository.save(user);

    return '회원가입이 완료되었습니다.';
  }

  async login(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;

    const user = await this.findByEmail(email);
    if (!user) {
      throw new BadRequestException('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }

  findAll() {
    return this.userRepository.find();
  }

  findById(id: number) {
    return this.userRepository.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.userRepository.update(id, updateUserDto);
  }

  async remove(id: number, user: any) {
    const existUser = await this.userRepository.findOne({ where: { id } });

    if (!existUser) throw new NotFoundException('존재하지 않는 유저입니다.');

    if (existUser.id !== user.userId) throw new ForbiddenException('본인만 탈퇴할 수 있습니다.');

    await this.userRepository.delete(id);

    return '탈퇴가 완료되었습니다.';
  }
}
