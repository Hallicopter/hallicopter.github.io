# advait.live

The source for [advait.live](https://advait.live), a Jekyll site with a whimsical, old-world aesthetic, dynamic 3D bookshelf, and long-form writing.

## Local development

```bash
bundle install
bundle exec jekyll serve --livereload
```

The site will be available at <http://127.0.0.1:4000>. Livereload keeps the browser in sync while you iterate on content or styles.

## Adding a new post

1. Create a Markdown file inside `_posts/` using the `YYYY-MM-DD-title.md` naming pattern.
2. Start the file with a front matter block:
   ```yaml
   ---
   layout: post
   title: "Title of the post"
   description: "Optional summary for listings"
   tags: [optional, tags]
   rating: 4.5 # optional, used by the theme
   ---
   ```
3. Write the post in Markdown below the front matter.
4. Run the site locally to verify formatting, then commit and push.

## Adding a book to the 3D bookshelf

The bookshelf pulls its data from `assets/bookshelf/books.json`.

Each book entry has the shape:

```json
{
  "title": "Book title",
  "author": "Author name",
  "spineColor": "#5b402a",
  "accentColor": "#c89b58",
  "coverImage": "https://covers.openlibrary.org/b/id/...-L.jpg",
  "summary": "One sentence summary shown in the detail card.",
  "notes": "Personal note that appears inside the detail card.",
  "found": "Where/when you acquired the book."
}
```

Add a new object to the array, keeping the trailing commas valid, then hard refresh `/bookshelf-app/` while running Jekyll locally. Remote cover images should be HTTPS and CORS-friendly (Open Library works well). If `coverImage` is empty, the app renders a placeholder jacket using the accent colors.

## Deploying

Push directly to `master`. GitHub Pages rebuilds automatically; if you need to force a clean rebuild you can clear `_site/` locally (it is ignored by git).

## License

All content © Advait Raykar. Theme and supporting code released under the MIT license unless otherwise noted.
