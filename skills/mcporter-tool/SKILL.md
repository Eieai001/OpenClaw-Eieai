---
name: mcporter-tool
description: "Use mcporter to call MCP servers (MiniMax web_search, fetch, etc.). Activates when user wants to search web, fetch URL, or call MCP tools."
metadata:
  {
    "openclaw": { "emoji": "🔌", "requires": { "bins": ["mcporter"] } },
  }
---

# MCPorter Tool

Call MCP servers directly via mcporter CLI.

## Available MCP Servers

- **MiniMax.web_search** - Web search (use for real-time info)
- **MiniMax.understand_image** - Analyze images
- **fetch** - Fetch web page content

## Commands

### List Available Servers

```bash
mcporter list
```

### List Server Tools

```bash
mcporter list MiniMax --schema
```

### Web Search

```bash
mcporter call MiniMax.web_search query: "search term"
```

### Fetch URL

```bash
mcporter call fetch url: "https://example.com"
```

### Image Understanding

```bash
mcporter call MiniMax.understand_image prompt: "描述图片内容" image_source: "/path/to/image.jpg"
```

## Tool Call Pattern

Use **exec** tool with mcporter commands:

```
mcporter call <server>.<tool> <arg1>: "value1" <arg2>: "value2"
```

## Auto-Load on Startup

To auto-start MCP servers with keep-alive:

```bash
mcporter config add <name> <command> --keep-alive
mcporter daemon start
```

Or configure in ~/.mcporter/mcporter.json with `"keepAlive": true`.
