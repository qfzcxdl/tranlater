#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path

from md_to_docx import md_to_docx

from md2docx.toc_processor import process_docx_toc


class MarkdownToDocxConverter:
    SUPPORTED_THEMES = ["default", "dark", "forest", "ocean", "elegant"]

    def __init__(self, theme: str = "default"):
        if theme not in self.SUPPORTED_THEMES:
            print(f"警告: 不支持的主题 '{theme}'，使用默认主题 'default'")
            theme = "default"
        self.theme = theme

    def convert_file(self, input_path: str, output_path: str) -> bool:
        input_file = Path(input_path)

        if not input_file.exists():
            print(f"❌ 文件不存在: {input_path}")
            return False

        if input_file.suffix.lower() not in [".md", ".markdown"]:
            print(f"❌ 不是Markdown文件: {input_path}")
            return False

        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            md_content = input_file.read_text(encoding="utf-8")

            md_to_docx(
                md_content=md_content,
                output_file=str(output_file),
                mermaid_theme=self.theme,
                debug_mode=False,
            )

            bookmark_count = process_docx_toc(str(output_file))
            if bookmark_count > 0:
                print(f"         🔗 添加 {bookmark_count} 个可点击书签")

            return True

        except Exception as e:
            print(f"❌ 转换失败: {input_path}")
            print(f"   错误信息: {e}")
            return False

    def convert_directory(self, input_dir: str, output_dir: str) -> tuple[int, int]:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        input_path = Path(input_dir)
        md_files = list(input_path.glob("*.md")) + list(input_path.glob("*.markdown"))

        if not md_files:
            print(f"⚠️  在 '{input_dir}' 目录中未找到Markdown文件")
            return (0, 0)

        print(f"📁 找到 {len(md_files)} 个Markdown文件")
        print(f"🎨 使用主题: {self.theme}")
        print("=" * 60)
        print()

        success_count = 0
        fail_count = 0

        for idx, md_file in enumerate(md_files, 1):
            print(f"[{idx}/{len(md_files)}] 🔄 转换中: {md_file.name}")

            output_file = Path(output_dir) / f"{md_file.stem}.docx"

            if self.convert_file(str(md_file), str(output_file)):
                success_count += 1
                print(f"         ✅ 完成: {output_file.name}")
            else:
                fail_count += 1

            print()

        print("=" * 60)
        print("📊 转换统计:")
        print(f"   ✅ 成功: {success_count}/{len(md_files)}")
        print(f"   ❌ 失败: {fail_count}/{len(md_files)}")
        print(f"   📂 输出目录: {output_dir}")
        print("=" * 60)

        return (success_count, fail_count)
