"""Downloads a URL with parallel range requests and writes it to stdout in order."""
import sys, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

url, conns = sys.argv[1], int(sys.argv[2])
CHUNK = 48 << 20
size = int(urllib.request.urlopen(urllib.request.Request(url, method="HEAD")).headers["Content-Length"])

def fetch(start):
    end = min(start + CHUNK, size) - 1
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
            data = urllib.request.urlopen(req, timeout=60).read()
            if len(data) == end - start + 1:
                return data
        except Exception as e:
            print(f"retry {start}: {e}", file=sys.stderr)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed at {start}")

window = threading.Semaphore(conns * 2)
def gated(start):
    return fetch(start)

out = sys.stdout.buffer
t0 = time.time()
with ThreadPoolExecutor(conns) as pool:
    pending = []
    starts = iter(range(0, size, CHUNK))
    done = 0
    def top_up():
        while len(pending) < conns * 2:
            s = next(starts, None)
            if s is None:
                return
            pending.append(pool.submit(fetch, s))
    top_up()
    while pending:
        data = pending.pop(0).result()
        out.write(data)
        done += len(data)
        top_up()
        if (done // CHUNK) % 20 == 0:
            print(f"fetched {done/1e9:.1f}/{size/1e9:.1f} GB, {done/1e6/(time.time()-t0):.1f} MB/s", file=sys.stderr)
out.flush()
