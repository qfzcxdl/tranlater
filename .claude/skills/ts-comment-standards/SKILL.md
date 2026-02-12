---
name: ts-comment-standards
description: TypeScript 代码中文注释标准化工具。用于为 TypeScript/JavaScript 代码添加规范的中文注释，确保关键步骤有清晰的解释。触发场景：(1) 用户要求添加代码注释，(2) 用户要求代码文档化，(3) 用户要求解释代码逻辑，(4) 代码审查时发现缺少注释，(5) 新增功能需要添加注释说明。
---

# TypeScript 中文注释标准

为 TypeScript 代码添加规范的中文注释，确保代码可读性和可维护性。

## 注释类型与格式

### 1. 文件头注释

每个重要文件顶部添加文件说明：

```typescript
/**
 * @file 用户认证服务
 * @description 处理 OAuth 2.0 登录流程，管理用户会话状态
 * @module services/auth
 */
```

### 2. 类/接口注释 (JSDoc)

```typescript
/**
 * 认证服务 - 管理用户登录状态的单例类
 * 使用 OAuth 2.0 + PKCE 流程进行 Google 认证
 *
 * @example
 * const auth = AuthService.getInstance(context);
 * await auth.login();
 */
export class AuthService {
  // ...
}
```

### 3. 方法/函数注释 (JSDoc)

```typescript
/**
 * 交换授权码获取用户信息
 *
 * @param code - 授权回调返回的授权码
 * @param codeVerifier - PKCE 验证码
 * @param config - OAuth 配置（clientId, clientSecret, redirectUri）
 * @returns 包含用户邮箱、姓名、头像的用户信息对象
 * @throws 当 token 交换失败或用户信息获取失败时抛出错误
 */
private async exchangeCodeForUserInfo(
  code: string,
  codeVerifier: string,
  config: OAuthConfig
): Promise<UserInfo> {
  // ...
}
```

### 4. 关键步骤注释

在复杂逻辑的关键步骤添加行内注释：

```typescript
async login(): Promise<UserInfo | null> {
  // 步骤1: 获取 OAuth 配置
  const config = this.getOAuthConfig();

  // 步骤2: 生成 PKCE 参数和状态值
  const pkce = generatePKCE();
  const state = generateState();

  // 步骤3: 启动回调服务器并构建认证 URL
  this.callbackServer = new AuthCallbackServer(this.getServerPort());
  const authUrl = buildAuthUrl({ /* ... */ });

  // 步骤4: 打开浏览器等待用户授权
  const { code } = await this.openBrowserAndWaitForCallback(authUrl, state);

  // 步骤5: 用授权码换取用户信息
  const userInfo = await this.exchangeCodeForUserInfo(code, pkce.codeVerifier, config);

  // 步骤6: 保存用户信息并发送通知
  this.saveUserAndNotify(userInfo);

  return userInfo;
}
```

### 5. 常量/配置注释

```typescript
// 认证超时时间：5分钟
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

// 用户信息在数据库中的存储键
const USER_STORAGE_KEY = 'user';

// 配置刷新间隔：5分钟
private readonly refreshInterval = 5 * 60 * 1000;
```

### 6. 条件分支注释

```typescript
if (this.loginInProgress) {
  // 登录流程正在进行中，避免重复触发
  return null;
}

if (!apolloConfig.access_key) {
  // Apollo 访问密钥为空，跳过远程配置加载
  return;
}
```

### 7. 错误处理注释

```typescript
try {
  await this.initializeApollo();
} catch (err) {
  // Apollo 初始化失败不影响主流程，记录错误后继续
  error('[ConfigManager] Failed to initialize Apollo', err);
}
```

## 注释规范

### 必须添加注释的场景

1. **公共 API** - 所有 export 的类、接口、函数、常量
2. **复杂算法** - 非直观的业务逻辑或算法实现
3. **多步骤流程** - 包含 3 个以上步骤的方法
4. **配置项** - 魔法数字、超时时间、阈值等
5. **异常处理** - 解释为什么捕获异常及处理方式
6. **条件分支** - 不明显的条件判断逻辑
7. **TODO/FIXME** - 待办事项和已知问题

### 注释语言规范

- **使用中文**：所有注释使用简体中文
- **简洁明了**：避免冗余，直接说明意图
- **动词开头**：方法注释以动词开头（获取、设置、验证、处理等）
- **避免废话**：不要重复代码本身已经表达的内容

### 不需要注释的场景

- 简单的 getter/setter
- 自解释的变量名和方法名
- 标准库方法的简单调用

## 示例对比

### 差的注释

```typescript
// 获取用户
getUser() { ... }

// i 加 1
i++;

// 调用 login 方法
await this.login();
```

### 好的注释

```typescript
/**
 * 获取当前已认证的用户信息
 * @returns 用户信息对象，未登录时返回 null
 */
getUser(): UserInfo | null { ... }

// 跳过表头行，从数据行开始处理
i++;

// 用户未登录时自动触发 OAuth 认证流程
await this.login();
```

## 执行流程

为代码添加注释时，按以下步骤执行：

1. **阅读并理解代码** - 先完整阅读代码逻辑
2. **识别关键点** - 找出需要注释的位置（参考"必须添加注释的场景"）
3. **编写 JSDoc** - 为类、接口、方法添加 JSDoc 注释
4. **添加步骤注释** - 为复杂流程添加步骤说明
5. **补充行内注释** - 为条件分支、配置项添加解释
6. **检查质量** - 确保注释准确、简洁、使用中文
