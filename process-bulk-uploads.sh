PID_FILE=/var/run/process-bulk-uploads.pid
if [ -e $PID_FILE ]; then
  echo "script is already running"
  exit
fi

# Ensure PID file is removed on program exit.
trap "rm -f -- '$PID_FILE'" EXIT

# Create a file with current PID to indicate that process is running.
echo $$ > "$PID_FILE"

node /app/process-bulk-uploads.js