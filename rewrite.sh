#!/bin/bash
set -e

# Start time: 25 July 2025, 21:30:00 IST → convert to UTC for Git
start_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "2025-07-25 21:30:00" "+%s")
increment=60  # 1 minute between commits

# Format timestamp as ISO 8601 with +05:30 offset
format_date() {
  local ts=$1
  date -u -r "$ts" "+%Y-%m-%dT%H:%M:%S+05:30"
}

# Launch rebase
git rebase -i --root

# Begin rewriting each commit timestamp
while true; do
  new_date=$(format_date "$start_epoch")
  echo "Setting commit date to $new_date"
  GIT_COMMITTER_DATE="$new_date" git commit --amend --no-edit --date "$new_date"
  start_epoch=$((start_epoch + increment))
  if ! git rebase --continue 2>/dev/null; then
    echo "Rebase complete."
    break
  fi
done

git push --force
