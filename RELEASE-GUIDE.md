# Tivra DebugMind - Release Guide

## Switching Between Demo and Beta Release

### Current Configuration
- **Demo (Development)**: `http://localhost:3001`
- **Beta Release (Production)**: `https://copilot.tivra.ai`

### How to Switch for Beta Release

#### Method 1: Code Change (Permanent)
Edit `src/extension.ts` line 16:

```typescript
// Demo version (current):
apiUrl = vscode.workspace.getConfiguration('tivra').get<string>('apiUrl') || 'http://localhost:3001';

// Change to Beta Release:
apiUrl = vscode.workspace.getConfiguration('tivra').get<string>('apiUrl') || 'https://copilot.tivra.ai';
```

Then compile and package:
```bash
npm run compile
npm run package
```

#### Method 2: VS Code Settings (User Override)
Users can override the API URL in their VS Code settings without changing code:

1. Open VS Code Settings (`Cmd+,` on Mac, `Ctrl+,` on Windows)
2. Search for "Tivra API URL"
3. Set: `https://copilot.tivra.ai`

Or add to `settings.json`:
```json
{
  "tivra.apiUrl": "https://copilot.tivra.ai"
}
```

### Quick Reference

| Environment | URL | Use Case |
|------------|-----|----------|
| **Demo** | `http://localhost:3001` | Local development, testing with local server |
| **Beta** | `https://copilot.tivra.ai` | Production release, real AWS integration |

### Packaging for Release

#### Demo Package (localhost)
```bash
npm run package
# Creates: tivra-debugmind-0.2.1-beta.vsix (points to localhost:3001)
```

#### Beta Package (production)
1. Edit `src/extension.ts` line 16 to use `https://copilot.tivra.ai`
2. Run:
```bash
npm run compile
npm run package
# Creates: tivra-debugmind-0.2.1-beta.vsix (points to copilot.tivra.ai)
```

### Installation
```bash
code --install-extension tivra-debugmind-0.2.1-beta.vsix
```

### Verification
Check console logs when extension activates:
```
🤖 Tivra DebugMind activated!
API URL: http://localhost:3001  (or https://copilot.tivra.ai)
```

---

**Note**: The comment in the code (`// Demo: http://localhost:3001 | Beta Release: https://copilot.tivra.ai`) serves as a reminder for quick switching.
