import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.api.realtime_presence import SpatialGrid

client = TestClient(app)

def test_realtime_stats_and_players():
    res = client.get("/api/v1/ws/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["supported_concurrent_capacity"] >= 200
    assert "spatial_grid_cells_active" in data

    players_res = client.get("/api/v1/ws/active-players")
    assert players_res.status_code == 200
    assert "players" in players_res.json()

def test_spatial_grid_partitioning():
    grid = SpatialGrid(cell_size=300)
    grid.update_player("p1", 0, 0, 100, 100)
    grid.update_player("p2", 0, 0, 200, 200)
    grid.update_player("p3", 0, 0, 1500, 1500) # Far away quadrant

    nearby = grid.get_nearby_player_ids(150, 150, radius=1)
    assert "p1" in nearby
    assert "p2" in nearby
    assert "p3" not in nearby  # Verify Area of Interest (AoI) isolation

    grid.remove_player("p1", 100, 100)
    assert "p1" not in grid.get_nearby_player_ids(150, 150, radius=1)
