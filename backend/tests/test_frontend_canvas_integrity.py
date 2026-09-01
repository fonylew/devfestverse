import subprocess
import os

def test_frontend_canvas_stability_and_render_loop():
    """Executes Node.js headless Canvas & render loop simulation to verify 0 runtime crashes."""
    test_script = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "tests", "test_canvas_stability.js")
    result = subprocess.run(["node", test_script], capture_output=True, text=True)
    assert result.returncode == 0, f"Canvas stability test failed:\n{result.stderr}\n{result.stdout}"
    assert "ALL CANVAS STABILITY TESTS PASSED WITH ZERO CRASHES" in result.stdout
