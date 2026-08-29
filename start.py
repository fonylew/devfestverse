import os
import uvicorn

if __name__ == "__main__":
    # Dynamically read port injected by Google Cloud Run (defaults to 8080)
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 Starting DevFestVerse server on host 0.0.0.0:{port}...")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, log_level="info")
