import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  if (!configService.getOrThrow<boolean>('apiGateway.swaggerEnabled')) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('MEMORA API')
    .setDescription('MEMORA - 3D Personalized Ring Design System')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  Logger.log('Swagger UI available at /api/docs', 'Bootstrap');
}
