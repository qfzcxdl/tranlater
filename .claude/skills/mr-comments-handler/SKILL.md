---
name: MR Comments Handler
description: "GitLab MR comment handling workflow. Fetch MR comments, process review suggestions, fix code issues, add unit tests, and mark comments as resolved. Supports GitLab API operations."
---

# MR Comments Handler Skill

Complete workflow for handling GitLab Merge Request comments, including fetching comments, analyzing issues, fixing code, adding tests, and marking as resolved.

## Use Cases

- User runs `/pr-comments` or `/mr-comments` to view comments
- User requests processing of a specific comment suggestion
- User requests marking a comment as resolved

## Workflow

### 1. Fetch MR Comments

```bash
# Get MR for current branch
GITLAB_HOST=git.garena.com glab mr list --source-branch $(git branch --show-current)

# Get MR discussions (includes code comments)
GITLAB_HOST=git.garena.com glab api "projects/{encoded_project}/merge_requests/{mr_id}/discussions" | jq -r '
.[] | select(.notes[0].system == false) |
.notes[] |
"- @\(.author.username) \(if .position.new_path then "\(.position.new_path)#\(.position.new_line)" else "" end):
> \(.body)"'
```

### 2. Analyze Comment Content

Comment type classification:
- **Code Quality**: Using better libraries/methods, refactoring suggestions
- **Security Issues**: Special character handling, injection risks
- **Functional Defects**: Logic errors, boundary conditions
- **Test Coverage**: Add unit tests

### 3. Process Comments

#### 3.1 Use Third-Party Library Instead of Manual Implementation

**Scenario**: Comment suggests using a library instead of manual concatenation (like DSN strings)

**Fix Steps**:
1. Read related code, understand current implementation
2. Find official/recommended library methods
3. Modify code to use library methods
4. Update import statements
5. Verify compilation passes

**Example - MySQL DSN Construction**:

```go
// Before fix: manually concatenate DSN
import "net/url"

dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True",
    url.QueryEscape(config.Username),
    url.QueryEscape(config.Password),
    config.Host,
    config.Port,
    config.DBName,
)

// After fix: use mysql.Config
import "github.com/go-sql-driver/mysql"

mysqlConfig := mysql.Config{
    User:                 config.Username,
    Passwd:               config.Password,
    Net:                  "tcp",
    Addr:                 fmt.Sprintf("%s:%d", config.Host, config.Port),
    DBName:               config.DBName,
    Params:               map[string]string{"charset": "utf8mb4"},
    ParseTime:            true,
    Loc:                  time.Local,
    Timeout:              timeout,
    AllowNativePasswords: true,
}
dsn := mysqlConfig.FormatDSN()
```

#### 3.2 Add Unit Tests

**Scenario**: After fixing code, need to add test coverage

**Test Pattern**:
```go
func TestXxx_SpecialCases(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name     string
        input    string
        expected string
    }{
        // Test case list
    }

    for _, tt := range tests {
        tt := tt
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            // Test logic
        })
    }
}
```

**Special Character Test Case Checklist**:
| Character | Example | Description |
|-----------|---------|-------------|
| `@` | `pass@word` | DSN separator |
| `:` | `pass:word` | Username/password separator |
| `/` | `pass/word` | Path separator |
| `?` | `pass?word` | Query parameter start |
| `&` | `pass&word` | Query parameter separator |
| `=` | `pass=word` | Key-value separator |
| `%` | `pass%word` | URL encoding prefix |
| `#` | `pass#word` | Fragment identifier |
| Space | `pass word` | Needs encoding |
| Chinese | `密码123` | Multi-byte character |

### 4. Verify Fix

```bash
# Compile verification
go build ./...

# Run related tests
go test ./path/to/package/... -v -run "TestName"

# Run complete tests
go test ./path/to/package/... -count=1
```

### 5. Mark Comment as Resolved

```bash
# Get discussion ID
GITLAB_HOST=git.garena.com glab api "projects/{encoded_project}/merge_requests/{mr_id}/discussions" | \
  jq -r '.[] | select(.notes[0].body | contains("keyword")) | .id'

# Mark as resolved
GITLAB_HOST=git.garena.com glab api \
  "projects/{encoded_project}/merge_requests/{mr_id}/discussions/{discussion_id}" \
  -X PUT -f resolved=true
```

## Common Comment Types and Handling

### Type 1: Use Third-Party Library

**Comment Example**: "Check if there's a third-party library for concatenation here, don't concatenate directly"

**Handling Steps**:
1. Identify current manual implementation
2. Find corresponding official/third-party library
3. Refactor code to use library methods
4. Add special case unit tests
5. Mark comment as resolved

### Type 2: Security Issues

**Comment Example**: "There's a SQL injection risk here"

**Handling Steps**:
1. Analyze vulnerability point
2. Use parameterized queries or escaping
3. Add security test cases
4. Mark comment as resolved

### Type 3: Error Handling

**Comment Example**: "Need to check nil here"

**Handling Steps**:
1. Add nil check
2. Return clear error message
3. Add boundary condition tests
4. Mark comment as resolved

### Type 4: Code Style

**Comment Example**: "Suggest extracting as constant"

**Handling Steps**:
1. Extract magic value as constant
2. Add constant comment
3. Mark comment as resolved

## Output Format

After processing, output a summary in the following format:

```markdown
## Processing Complete

**MR Comment**: `@username` - "comment content"

**Fixes**:
- Fix description 1
- Fix description 2

**Modified Files**: `file_path:line_range`

**Before**:
```code
original code
```

**After**:
```code
fixed code
```

**New Tests**: `test_function_name`

**Status**: ✅ Tests passed, comment marked as resolved
```

## GitLab API Common Commands

```bash
# Set GitLab host
export GITLAB_HOST=git.garena.com

# List MRs for current branch
glab mr list --source-branch $(git branch --show-current)

# View MR details
glab mr view {mr_id}

# Get MR comments
glab api "projects/{encoded_project}/merge_requests/{mr_id}/notes"

# Get MR discussions (code comments)
glab api "projects/{encoded_project}/merge_requests/{mr_id}/discussions"

# Mark discussion as resolved
glab api "projects/{encoded_project}/merge_requests/{mr_id}/discussions/{discussion_id}" \
  -X PUT -f resolved=true

# Add comment
glab api "projects/{encoded_project}/merge_requests/{mr_id}/notes" \
  -X POST -f body="comment content"
```

## Project Path Encoding

GitLab API requires URL encoding for project paths:
- Original: `shopee/bg-logistics/qa/tst/tst-go`
- Encoded: `shopee%2Fbg-logistics%2Fqa%2Ftst%2Ftst-go`

## Reference Resources

- [GitLab MR Discussions API](https://docs.gitlab.com/ee/api/discussions.html)
- [glab CLI Documentation](https://glab.readthedocs.io/)
