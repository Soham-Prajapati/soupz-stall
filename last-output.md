# Last Task Output

**Task:** Update Global and Local Gemini Rules
**Status:** ✅ Done

## Verification
- **Global File Line Count:** 72
- **Global File First 15 Lines:**
```
# Soham's Global Gemini Rules
# Applies to ALL projects automatically

## Universal Workflow Rules

1. **Language**: Always respond in English only. Never switch languages.

2. **New Project Setup**: When starting in any new project directory,
   check if a local .gemini.md exists in that directory.
   If it does NOT exist, create one by copying this global file
   and tell the user: "Created local .gemini.md — customize it 
   for this project."

3. **Output Logging**: After completing any task write TWO files
   in the current project root:
```
- **Local Rule #3:**
```
3. **Output Logging**: After every task write BOTH:
   - last-output.md (full raw text)
   - last-output.html (using the HTML template from global GEMINI.md)
   Never summarize. Full raw output always.
```

## Raw Shell Output
```
      72 /Users/shubh/.gemini/GEMINI.md
# Soham's Global Gemini Rules
# Applies to ALL projects automatically

## Universal Workflow Rules

1. **Language**: Always respond in English only. Never switch languages.

2. **New Project Setup**: When starting in any new project directory,
   check if a local .gemini.md exists in that directory.
   If it does NOT exist, create one by copying this global file
   and tell the user: "Created local .gemini.md — customize it 
   for this project."

3. **Output Logging**: After completing any task write TWO files
   in the current project root:
3. **Output Logging**: After every task write BOTH:
   - last-output.md (full raw text)
   - last-output.html (using the HTML template from global GEMINI.md)
   Never summarize. Full raw output always.

4. **Task Tracking**: Every project has a tasks.md with these states:
```
