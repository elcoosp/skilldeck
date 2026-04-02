#!/bin/bash
# copy_mdx_to_md.sh
# Usage: ./copy_mdx_to_md.sh [source_dir] [dest_dir]
#   source_dir : directory to search for .mdx files (default: current directory)
#   dest_dir   : output folder (default: ./out)

src="${1:-.}"
dest="${2:-./out}"

# Create destination directory if it doesn't exist
mkdir -p "$dest" || exit 1

echo "Copying all .mdx files from '$src' to '$dest' as .md files, preserving structure..."

find "$src" -type f -name "*.mdx" -print0 | while IFS= read -r -d '' file; do
    # Get relative path by removing source prefix
    relpath="${file#$src/}"
    relpath="${relpath#./}"  # remove leading ./ if source is .

    # Change the extension from .mdx to .md
    target_file="${relpath%.mdx}.md"
    target_dir="$dest/$(dirname "$target_file")"

    mkdir -p "$target_dir"
    cp "$file" "$target_dir/$(basename "$target_file")"
    echo "Copied: $file -> $target_dir/$(basename "$target_file")"
done

echo "Done."
