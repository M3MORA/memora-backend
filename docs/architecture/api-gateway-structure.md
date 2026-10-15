# API Gateway — Domain → Feature → Layer

Convention bắt buộc cho `apps/api-gateway`. Gateway là HTTP/SSE/WebSocket boundary: validate input, authn/authz HTTP, map DTO ↔ gRPC, Swagger. Không Prisma, không core domain rules, không transaction nghiệp vụ.

## Cây thư mục

```text
apps/api-gateway/src/
├── common/          # HTTP primitives dùng mọi domain (envelope, pagination, interceptors)
├── config/          # Bootstrap riêng Gateway (Swagger)
├── modules/
│   └── <domain>/
│       ├── <feature>/
│       │   ├── controllers/
│       │   ├── dto/request/ | dto/response/
│       │   ├── mappers/
│       │   ├── docs/
│       │   ├── services/ | guards/ | filters/ | cookies/   # chỉ khi có file
│       │   └── ...
│       ├── clients/           # gRPC (và HTTP outbound) dùng chung trong domain
│       ├── authorization/     # adapter domain-specific nếu có
│       └── <domain>.module.ts # composition root
├── app.module.ts
└── main.ts
```

Chỉ tạo thư mục khi đã có file. Không scaffold domain/feature tương lai. Không barrel export máy móc.

## Khi nào tạo feature

Một feature = một nhóm HTTP nghiệp vụ cùng bounded use-case (ví dụ `iam/auth`, sau này `iam/users`). Không gom mọi controller của domain vào `modules/<domain>/controllers/`. Không đặt mọi DTO vào `modules/<domain>/dto/`.

## Khi nào tách NestJS Feature Module

Mặc định: **một domain module**. Đăng ký controller/provider của mọi feature tại `<domain>.module.ts`.

Tách `<feature>.module.ts` chỉ khi feature đủ lớn, dependency riêng, cần import/export độc lập, hoặc có lifecycle/infrastructure riêng. Không tạo module chỉ để phản ánh folder.

## Layer trong feature

| Layer | Trách nhiệm |
|---|---|
| `controllers/` | Route, validation pipe sẵn có, decorator authz, gọi client, map HTTP |
| `dto/` | Class HTTP + class-validator + `@ApiProperty`. Không dùng gRPC/Prisma làm body |
| `mappers/` | gRPC message ↔ HTTP DTO |
| `docs/` | `applyDecorators` Swagger; bootstrap vẫn `config/swagger.config.ts` |
| `guards/` `filters/` `cookies/` | HTTP-only, thuộc feature |

Không bắt buộc mọi layer. Controller nhỏ có thể để Swagger inline.

## Domain gRPC client

`modules/<domain>/clients/` — một nguồn cấu hình connection cho service sở hữu domain. Feature cùng domain inject cùng client. Không duplicate `ClientsModule.registerAsync` / provider client.

Orchestration đa service trên Gateway chỉ khi đúng API boundary; invariant/transaction vẫn thuộc microservice.

## Shared code: `src/common/` vs `libs/` vs `modules/<domain>/…`

- `apps/api-gateway/src/common/`: HTTP Gateway-only, dùng **nhiều domain** (pagination query, success envelope, `@CurrentUser()`).
- `modules/<domain>/` (ví dụ `clients/`, `authorization/`): dùng **nhiều feature trong một domain**, không leak sang domain khác.
- `iam/shared/` hoặc `iam/common/`: chỉ khi **nhiều feature IAM** cùng consume một file; không đặt sẵn “vì chưa biết owner”.
- `libs/common`, `libs/auth`, `libs/contracts`, `libs/config`, `libs/observability`: tái sử dụng **đa process**. Không nhét IAM business hay HTTP DTO vào libs. Resolver IAM-specific ở lại Gateway.

## NestJS wiring

- Domain module import clients module, đăng ký HTTP controllers của domain, cấu hình `AuthorizationModule.forRoot()` nếu domain đó sở hữu.
- Global `APP_GUARD` đăng ký **một lần**, thứ tự hiện tại: `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`.
- Không đăng ký cùng provider ở nhiều module nếu sẽ tạo nhiều instance ngoài ý muốn.

## Naming

- Folder domain/feature: kebab-case (`ring-templates`).
- File: `<name>.controller.ts`, `<verb>-<resource>.request.dto.ts`, `<resource>.response.dto.ts`, `<feature>.swagger.ts`, `<target>-grpc.client.ts`.
- HTTP public prefix: `/api/v1`. Controller path theo feature (`auth`, sau này `users`), không nhét mọi IAM route vào một controller.

## Ví dụ IAM (hiện tại)

```text
modules/iam/
├── auth/            # register/login/refresh/OAuth/JWT/cookie/CSRF
├── authorization/   # HttpPrincipalResolver + IAM gRPC permission adapter
├── clients/         # IamGrpcClient + IamClientsModule
└── iam.module.ts
```

Feature `users` / `roles` / `permissions` chỉ tạo khi có HTTP API thật.

## Ví dụ Catalog (khi triển khai)

```text
modules/catalog/
├── ring-templates/controllers|dto|mappers|docs
├── materials/
├── gemstones/
├── clients/
└── catalog.module.ts
```

Tên feature thật phải khớp Main Flow và service boundary; không tạo folder trống trước.
