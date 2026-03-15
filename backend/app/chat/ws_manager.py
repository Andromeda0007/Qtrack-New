import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id."""

    def __init__(self):
        self._connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections[user_id] = websocket

    def disconnect(self, user_id: int):
        self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict):
        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                self.disconnect(user_id)

    async def broadcast_to_users(self, user_ids: List[int], payload: dict):
        for uid in user_ids:
            await self.send_to_user(uid, payload)

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections


manager = ConnectionManager()
