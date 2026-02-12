.PHONY: install convert convert-forest clean help

install:
	poetry install

convert:
	poetry run md2docx -i input -o output

convert-forest:
	poetry run md2docx -i input -o output --theme forest

convert-dark:
	poetry run md2docx -i input -o output --theme dark

toc:
	poetry run python -m md2docx.toc_processor -i output

lint:
	poetry run ruff check src/

format:
	poetry run ruff format src/

clean:
	rm -rf output/*.docx temp/* .ruff_cache __pycache__ src/**/__pycache__

help:
	@echo "Markdown to DOCX Converter"
	@echo ""
	@echo "Usage:"
	@echo "  make install        Install dependencies via Poetry"
	@echo "  make convert        Convert all files (default theme)"
	@echo "  make convert-forest Convert with forest theme"
	@echo "  make convert-dark   Convert with dark theme"
	@echo "  make toc            Add clickable TOC to output files"
	@echo "  make lint           Run linter"
	@echo "  make format         Format code"
	@echo "  make clean          Remove output files"
