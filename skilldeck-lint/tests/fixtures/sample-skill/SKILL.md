---
name: sample-skill
description: "A sample skill for testing the lint crate end-to-end with enough characters"
license: MIT
version: "1.0.0"
compatibility: ["claude-3", "gpt-4"]
allowed_tools: ["read_file"]
---

## Overview

This is a sample skill used in integration tests for the `skilldeck-lint` crate.

## Instructions

1. Use this skill when you need to demonstrate linting works.
2. Read a file using the `read_file` tool.
3. Return the processed content.

## Examples

```bash
read_file("path/to/file.txt")
```

## Dependencies

No external dependencies required.
