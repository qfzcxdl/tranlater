#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import sys

from md2docx.converter import MarkdownToDocxConverter


def main():
    parser = argparse.ArgumentParser(
        description="Markdown转DOCX转换工具 - 支持Mermaid图表自动转图片",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  md2docx                                    # 批量转换 input/ -> output/
  md2docx --theme forest                     # 使用forest主题
  md2docx -i docs -o outputs                 # 指定目录
  md2docx --single in.md out.docx            # 转换单个文件

主题: default, dark, forest, ocean, elegant
        """,
    )

    parser.add_argument("-i", "--input", default="input", help="输入目录")
    parser.add_argument("-o", "--output", default="output", help="输出目录")
    parser.add_argument(
        "-t",
        "--theme",
        default="default",
        choices=["default", "dark", "forest", "ocean", "elegant"],
        help="主题风格",
    )
    parser.add_argument("--single", nargs=2, metavar=("INPUT", "OUTPUT"), help="转换单个文件")
    parser.add_argument("-v", "--version", action="version", version="%(prog)s 1.0.0")

    args = parser.parse_args()

    print()
    print("🚀 Markdown转DOCX转换工具")
    print("   支持Mermaid图表自动转换为图片")
    print("=" * 60)
    print()

    converter = MarkdownToDocxConverter(theme=args.theme)

    if args.single:
        input_file, output_file = args.single
        print(f"📄 转换文件: {input_file}")
        print(f"🎨 使用主题: {args.theme}")
        print()

        if converter.convert_file(input_file, output_file):
            print(f"✅ 转换成功: {output_file}")
            sys.exit(0)
        else:
            print("❌ 转换失败")
            sys.exit(1)
    else:
        success, fail = converter.convert_directory(args.input, args.output)
        sys.exit(1 if fail > 0 else 0)


if __name__ == "__main__":
    main()
