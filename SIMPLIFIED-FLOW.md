# Simplified AWS Connection Flow

## Decision: Keep It Simple

After user feedback, we're keeping the AWS connection flow **simple and straightforward**:

### Current Implementation (Good!)
1. ✅ Auto-detect AWS config profiles (silent background check)
2. ✅ If found: Show profile names as quick buttons
3. ✅ Otherwise: Ask for SSO URL (same as before)
4. ✅ No complex wizard - just type the URL

### What We Removed
- ❌ Domain wizard (typing "acme" to generate URL)
- ❌ Complex branching logic
- ❌ Too many prompts

### User Experience

**Scenario 1: Has AWS CLI configured**
```
User: "Connect to AWS"
Extension: "Found 2 profiles:
  • my-company-prod
  • my-company-dev

  [my-company-prod] [my-company-dev]
  [Connect with AWS SSO] [Use Access Keys]"
```
→ **One click if profile exists**

**Scenario 2: No AWS CLI**
```
User: "Connect to AWS"
Extension: "Choose method:
  [Connect with AWS SSO] [Use Access Keys]"

User: Clicks "Connect with AWS SSO"
Extension: "Enter SSO Start URL:"
User: Types URL
Extension: "Enter Region:"
User: Clicks region
```
→ **Simple, familiar flow**

## Why This Is Better

1. **Not overwhelming** - Clear choices
2. **Fast for power users** - One click if config exists
3. **Simple for new users** - Just type the URL (they have it)
4. **No learning curve** - Straightforward

## Current Code Status

The code currently has:
- ✅ Profile detection (`parseAWSConfig()`)
- ✅ Profile selection handler
- ✅ Manual SSO URL flow
- ✅ Wizard code (can be removed later if not needed)

## Recommendation

**Keep current code as-is** because:
- Profile detection is useful (one-click for AWS CLI users)
- Manual URL entry works fine for others
- Wizard is there if we want to re-enable it later
- Not hurting anyone by having extra code paths

**Just reload VS Code window** to see the new flow!
