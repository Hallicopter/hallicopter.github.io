#!/usr/bin/env python3
import os
import re
from datetime import datetime
import sys

def extract_metadata(content):
    """Extract metadata from post content."""
    meta = {}
    if content.startswith('---'):
        end = content.find('---', 3)
        if end != -1:
            frontmatter = content[3:end].strip()
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    meta[key.strip()] = value.strip()
    return meta

def get_post_date(filename):
    """Extract date from filename using pattern YYYY-MM-DD."""
    match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', filename)
    if match:
        year, month, day = map(int, match.groups())
        try:
            return datetime(year, month, day)
        except ValueError:
            return datetime(1970, 1, 1)  # fallback for invalid dates
    return datetime(1970, 1, 1)  # fallback for files without dates

def main():
    posts_dir = '/Users/advait/hallicopter.github.io/_posts'
    output_file = '/Users/advait/hallicopter.github.io/all_posts.md'
    
    # Get all markdown files
    files = [f for f in os.listdir(posts_dir) if f.endswith('.md')]
    
    # Sort files by date (newest first)
    files.sort(key=get_post_date, reverse=True)
    
    # Create table of contents
    toc = []
    for file in files:
        with open(os.path.join(posts_dir, file), 'r', encoding='utf-8', errors='replace') as f:
            try:
                content = f.read()
                meta = extract_metadata(content)
                title = meta.get('title', file.replace('-', ' ').replace('.md', ''))
                date_obj = get_post_date(file)
                date_str = date_obj.strftime('%Y-%m-%d')
                toc.append(f"- [{date_str} - {title}](#{file.replace('.md', '').lower().replace(' ', '-').replace('.', '').replace('_', '-')})")
            except Exception as e:
                print(f"Error processing file {file}: {e}", file=sys.stderr)
                toc.append(f"- [Error processing: {file}](#{file.replace('.md', '').lower().replace(' ', '-').replace('.', '').replace('_', '-')})")
    
    # Write header and table of contents
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("# All Posts from hallicopter.github.io\n\n")
        out.write("This file contains a compilation of all blog posts from the `_posts` directory, organized chronologically.\n\n")
        out.write("## Table of Contents\n")
        for item in toc:
            out.write(f"{item}\n")
        out.write("\n---\n\n")
        
        # Write each post
        for file in files:
            with open(os.path.join(posts_dir, file), 'r', encoding='utf-8', errors='replace') as f:
                try:
                    content = f.read()
                    meta = extract_metadata(content)
                    title = meta.get('title', file.replace('-', ' ').replace('.md', ''))
                    date_obj = get_post_date(file)
                    date_str = date_obj.strftime('%Y-%m-%d')
                    
                    # Generate anchor
                    anchor = file.replace('.md', '').lower().replace(' ', '-').replace('.', '').replace('_', '-')
                    
                    # Write post header
                    out.write(f"<a id='{anchor}'></a>\n\n")
                    out.write(f"# {title}\n")
                    out.write(f"*{date_str}*\n\n")
                    
                    # Write post content (skip frontmatter)
                    if content.startswith('---'):
                        end = content.find('---', 3)
                        if end != -1:
                            post_content = content[end+3:].strip()
                            out.write(post_content + "\n\n")
                    else:
                        out.write(content + "\n\n")
                    
                    out.write("\n---\n\n")
                except Exception as e:
                    print(f"Error processing file {file}: {e}", file=sys.stderr)
                    out.write(f"## Error processing: {file}\n\n")
                    out.write("An error occurred while processing this file.\n\n")
                    out.write("\n---\n\n")

if __name__ == "__main__":
    main()
