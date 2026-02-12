.PHONY: install dev build package clean typecheck lint preview release

# 安装依赖
install:
	npm install

# 开发模式
dev:
	npm run dev

# 构建
build:
	npm run build

# 打包 macOS 应用
package:
	npm run package:mac

# 清理构建产物
clean:
	rm -rf dist dist-electron release node_modules/.vite

# 类型检查
typecheck:
	npm run typecheck

# 代码检查
lint:
	npm run lint

# 运行预览
preview:
	npm run preview

# 完整构建流程
release: clean install typecheck lint build package
	@echo "✅ Release build completed!"

# 帮助信息
help:
	@echo "Tranlater - Real-time Translation App"
	@echo ""
	@echo "Available targets:"
	@echo "  make install   - Install dependencies"
	@echo "  make dev       - Start development server"
	@echo "  make build     - Build the project"
	@echo "  make package   - Package macOS app"
	@echo "  make clean     - Clean build artifacts"
	@echo "  make typecheck - Run TypeScript type checking"
	@echo "  make lint      - Run code linting"
	@echo "  make release   - Full release build"
