#!/bin/bash
set -e

echo "🚀 Setting up Markdown to DOCX converter (Poetry)..."
echo "====================================================="

if ! command -v poetry &> /dev/null; then
    echo "❌ Poetry not found. Installing via pipx..."
    if command -v pipx &> /dev/null; then
        pipx install poetry
    else
        echo "Installing pipx first..."
        python3 -m pip install --user pipx
        python3 -m pipx ensurepath
        pipx install poetry
    fi
fi

echo "📦 Poetry version: $(poetry --version)"

echo "📥 Installing dependencies..."
poetry install

mkdir -p input output temp

echo ""
echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  make convert              # Batch convert"
echo "  make convert-forest       # With forest theme"
echo "  poetry run md2docx --help # Show all options"
echo ""
