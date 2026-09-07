---
name: gdrive
description: Use when the user asks about a file in Google Drive, names a Drive file or folder, or says gdrive. Lists, searches, reads, downloads, and manages Drive files via the gdrive CLI.
---

# gdrive

Personal Google Drive CLI. Stdlib-only Python, OAuth tokens in `~/.config/gdrive/`.

## Commands

* `gdrive ls [-n 20] [FOLDER_ID]` lists recent files, or children of a folder.
* `gdrive search QUERY [-n 20]` finds files by name. Works with shared drives.
* `gdrive meta FILE_ID` prints full metadata as JSON. Use this to resolve a name to an ID.
* `gdrive read FILE_ID` prints file content to stdout. Google Docs, Sheets, and Slides auto-export to plain text or CSV.
* `gdrive download FILE_ID -o PATH` saves a file locally.
* `gdrive mkdir NAME [--parent FOLDER_ID]` creates a folder.
* `gdrive upload PATH [--parent FOLDER_ID] [--name NAME]` uploads a file.
* `gdrive rename FILE_ID NEW_NAME` renames.
* `gdrive move FILE_ID --to FOLDER_ID` moves.
* `gdrive trash FILE_ID` trashes. `gdrive delete FILE_ID` deletes permanently.

## Rules

* A Drive name is not an ID. Run `gdrive search` or `gdrive ls` first to resolve it.
* Read-only questions stop at `search`, `meta`, `read`, or `download`. Never trash, delete, move, or rename without an explicit request.
* `gdrive` signs in as the user. If it reports not being signed in, tell the user to run `gdrive auth` and stop.
