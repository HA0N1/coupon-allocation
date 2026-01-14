import { Injectable, CanActivate, ExecutionContext, applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { UserRole } from 'src/user/entities/user.entity';

// 1. JWT 검증 가드 (로그인 체크)
@Injectable()
export class JwtAuthGuard extends PassportAuthGuard('jwt') {}

// 2. 권한 검증 가드 (Role 체크)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Role 제한이 없으면 통과
    if (!requiredRoles) return true;

    // JwtAuthGuard를 통과했다면 user 정보가 request에 있음
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) return false;

    return requiredRoles.some((role) => user.role === role);
  }
}

// 3. 통합 데코레이터
export function Auth(...roles: UserRole[]) {
  if (roles.length === 0) {
    // 로그인만 체크
    return applyDecorators(UseGuards(JwtAuthGuard));
  }

  // 로그인 + 역할 체크
  return applyDecorators(SetMetadata('roles', roles), UseGuards(JwtAuthGuard, RolesGuard));
}
