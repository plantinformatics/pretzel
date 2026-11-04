# https://chatgpt.com/c/6aea7e40-3478-83ec-b10c-220a6e053285

# ... function to guard against multiple instances of the script creating additional processes for those long-running tasks.

#-------------------------------------------------------------------------------

# Usage: withLock LOCK_FILE COMMAND [ARG...]
# Wait up to one hour; return 75 if the lock remains busy.
# Otherwise return COMMAND's exit status.
#
# Note that this function body is enclosed with parentheses () instead of curly
# braces {}, indicating it will execute in a sub-shell instead of within the
# current shell.
function withLock() (
  if (( $# < 2 )); then
    printf 'Usage: withLock LOCK_FILE COMMAND [ARG...]\n' >&2
    return 2
  fi

  local lock_file=$1
  shift

  local lock_fd
  exec {lock_fd}>>"$lock_file" || return 2

  flock --exclusive --wait 3600 --conflict-exit-code 75 "$lock_fd" ||
    return "$?"

  "$@"
)
# ```

# The parentheses run the function in a subshell. Its file descriptor closes when the function finishes, releasing the lock automatically.

# For example:

# ```bash
function createOutput() {
  local output=$1

  # Another instance may have completed it while we waited.
  if [[ -s "$output" ]]; then
      return 0
  fi

  # Write alongside the destination, then publish the completed file.
  local temporary
  temporary=$(mktemp -- "${output}.tmp.XXXXXX") || return 1
  trap 'rm -f -- "$temporary"' EXIT

  long_running_command >"$temporary" || return "$?"

  # Add output validation here if needed.
  mv -- "$temporary" "$output"
}

function long_running_command()
{
  sleep 10
  date
}

function test_example_createOutput()
{
  local output=/tmp/$USER/result.txt

  if withLock "${output}.lock" createOutput "$output"; then
    printf 'Output ready: %s\n' "$output"
  else
    status=$?
    printf 'Task failed or lock wait timed out (status %s)\n' "$status" >&2
    exit "$status"
  fi
}

# ```

# Replace `long_running_command` with your actual command. Keep it in the foreground so the lock covers its full execution.

# **Leave the lock file in place.** Its existence does not mean it is locked; the operating system tracks that. Deleting it can allow different instances to lock different underlying files at the same pathname.

# This also avoids needing different return codes for “started immediately” and “waited”: once the lock is acquired, checking the output handles both cases. All cooperating instances must use the same lock pathname, preferably on a local filesystem.
