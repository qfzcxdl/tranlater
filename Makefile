.PHONY: install dev build package clean typecheck lint preview release help

# 安装依赖
install:
	npm install

# 开发模式（热重载）
dev:
	npm run dev

# 构建生产版本
build:
	npm run build

# 打包 macOS 应用
package:
	npm run package:mac

# 清理构建产物
clean:
	rm -rf dist out release node_modules/.vite

# TypeScript 类型检查
typecheck:
	npm run typecheck

# 代码检查
lint:
	npm run lint

# 运行预览
preview:
	npm run preview

# 完整构建流程（清理 → 安装 → 检查 → 构建 → 打包）
release: clean install typecheck build package
	@echo "Release build completed!"

# 帮助信息
help:
	@echo "Tranlater - Real-time Translation App for macOS"
	@echo ""
	@echo "Available targets:"
	@echo "  make install   - Install npm dependencies"
	@echo "  make dev       - Start development server with HMR"
	@echo "  make build     - Build for production"
	@echo "  make package   - Package macOS app (dmg)"
	@echo "  make clean     - Clean build artifacts"
	@echo "  make typecheck - Run TypeScript type checking"
	@echo "  make lint      - Run ESLint code linting"
	@echo "  make preview   - Preview production build"
	@echo "  make release   - Full release build pipeline"
	@echo "  make help      - Show this help message"
