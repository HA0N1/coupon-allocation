import { utilities as nestWinston, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      level: isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.ms(),
        nestWinston.format.nestLike('CouponAllocation', {
          colors: !isProduction,
          prettyPrint: true,
        }),
      ),
    }),
    // 프로덕션 환경에서는 파일로도 저장
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ]
      : []),
  ],
};

export const createWinstonLogger = () => WinstonModule.createLogger(winstonConfig);
